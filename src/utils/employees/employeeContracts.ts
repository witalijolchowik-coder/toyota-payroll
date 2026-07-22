import type {
  Employee,
  EmployeeContract,
  EmploymentEndEvent,
  IsoDate,
} from '../../types/firestore';

const DAY_MS = 86_400_000;

export type ContractValidationCode = 'invalid-range' | 'duplicate' | 'overlap';

export interface ContractValidationIssue {
  code: ContractValidationCode;
  conflictingContractId?: string;
}

export interface EmploymentCoveragePeriod {
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface LegacyContractMigrationPlan {
  contractId: string;
  sequenceId: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  restoreOperationalActive: boolean;
}

export function employeeContractHistoryRevision(
  employee: Pick<Employee, 'contracts' | 'employmentEndEvents'>,
): string {
  const contracts = [...(employee.contracts ?? [])]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((contract) => [
      contract.id,
      contract.sequenceId,
      contract.startDate,
      contract.endDate,
      contract.status,
      contract.updatedAt?.toISOString() ?? null,
    ]);
  const endEvents = [...(employee.employmentEndEvents ?? [])]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((event) => [
      event.id,
      event.sequenceId,
      event.endDate,
      event.status,
      event.updatedAt?.toISOString() ?? null,
    ]);

  return JSON.stringify({ contracts, endEvents });
}

function isoDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

function addDays(value: IsoDate, days: number): IsoDate {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function daysInclusive(start: IsoDate, end: IsoDate): number {
  return (
    Math.floor(
      (Date.parse(`${end}T00:00:00.000Z`) -
        Date.parse(`${start}T00:00:00.000Z`)) /
        DAY_MS,
    ) + 1
  );
}

export function activeContracts(
  employee: Pick<Employee, 'contracts'>,
): EmployeeContract[] {
  const contracts = (employee.contracts ?? []).filter(
    (contract) => contract.status === 'ACTIVE',
  );
  return [...contracts].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function planLegacyContractMigration(
  employee: Pick<
    Employee,
    | 'id'
    | 'contracts'
    | 'employmentStartDate'
    | 'employmentEndDate'
    | 'employmentEndEvents'
    | 'isActive'
  >,
): LegacyContractMigrationPlan | null {
  if ((employee.contracts?.length ?? 0) > 0 || !employee.employmentStartDate) {
    return null;
  }
  const startDate = isoDate(employee.employmentStartDate);
  const endDate = employee.employmentEndDate
    ? isoDate(employee.employmentEndDate)
    : null;
  const matchingExplicitEnd = (employee.employmentEndEvents ?? []).find(
    (event) =>
      event.status === 'ACTIVE' &&
      Boolean(endDate) &&
      event.endDate === endDate,
  );
  return {
    contractId: `legacy-${employee.id}`,
    sequenceId: matchingExplicitEnd?.sequenceId ?? `legacy-${employee.id}`,
    startDate,
    endDate,
    restoreOperationalActive: !matchingExplicitEnd && !employee.isActive,
  };
}

export function validateEmployeeContract(
  candidate: Pick<EmployeeContract, 'id' | 'startDate' | 'endDate'>,
  contracts: readonly EmployeeContract[],
): ContractValidationIssue[] {
  if (candidate.endDate && candidate.endDate < candidate.startDate) {
    return [{ code: 'invalid-range' }];
  }
  const others = contracts.filter(
    (contract) => contract.status === 'ACTIVE' && contract.id !== candidate.id,
  );
  const duplicate = others.find(
    (contract) =>
      contract.startDate === candidate.startDate &&
      contract.endDate === candidate.endDate,
  );
  if (duplicate) {
    return [{ code: 'duplicate', conflictingContractId: duplicate.id }];
  }
  const candidateEnd = candidate.endDate ?? '9999-12-31';
  const overlap = others.find(
    (contract) =>
      contract.startDate <= candidateEnd &&
      (contract.endDate ?? '9999-12-31') >= candidate.startDate,
  );
  return overlap
    ? [{ code: 'overlap', conflictingContractId: overlap.id }]
    : [];
}

export function resolveCurrentContract(
  employee: Pick<Employee, 'contracts'>,
  today = new Date(),
): EmployeeContract | null {
  const todayIso = isoDate(today);
  return (
    activeContracts(employee).find(
      (contract) =>
        contract.startDate <= todayIso &&
        (!contract.endDate || contract.endDate >= todayIso),
    ) ?? null
  );
}

export function resolveLatestContract(
  employee: Pick<Employee, 'contracts'>,
): EmployeeContract | null {
  return activeContracts(employee).at(-1) ?? null;
}

export function resolveFutureContract(
  employee: Pick<Employee, 'contracts'>,
  today = new Date(),
): EmployeeContract | null {
  const todayIso = isoDate(today);
  return (
    activeContracts(employee).find(
      (contract) => contract.startDate > todayIso,
    ) ?? null
  );
}

export function contractStatus(
  contract: EmployeeContract,
  today = new Date(),
): 'FUTURE' | 'CURRENT' | 'ENDED' | 'CANCELLED' {
  if (contract.status === 'CANCELLED') return 'CANCELLED';
  const todayIso = isoDate(today);
  if (contract.startDate > todayIso) return 'FUTURE';
  if (!contract.endDate || contract.endDate >= todayIso) return 'CURRENT';
  return 'ENDED';
}

export function mergeEmploymentCoverage(
  contracts: readonly EmployeeContract[],
): EmploymentCoveragePeriod[] {
  const sorted = contracts
    .filter((contract) => contract.status === 'ACTIVE' && contract.endDate)
    .map((contract) => ({
      startDate: contract.startDate,
      endDate: contract.endDate!,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const result: EmploymentCoveragePeriod[] = [];
  for (const period of sorted) {
    const previous = result.at(-1);
    if (!previous || period.startDate > addDays(previous.endDate, 1)) {
      result.push({ ...period });
    } else if (period.endDate > previous.endDate) {
      previous.endDate = period.endDate;
    }
  }
  return result;
}

export function isDateCoveredByContracts(
  employee: Pick<Employee, 'contracts'>,
  date: IsoDate,
): boolean {
  return activeContracts(employee).some(
    (contract) =>
      contract.startDate <= date &&
      (!contract.endDate || contract.endDate >= date),
  );
}

export function employeeContractsOverlapRange(
  employee: Pick<Employee, 'contracts'>,
  start: IsoDate,
  end: IsoDate,
): boolean {
  return activeContracts(employee).some(
    (contract) =>
      contract.startDate <= end &&
      (!contract.endDate || contract.endDate >= start),
  );
}

export function isRangeFullyCoveredByContracts(
  employee: Pick<Employee, 'contracts'>,
  start: IsoDate,
  end: IsoDate,
): boolean {
  if (end < start) return false;
  let cursor = start;
  for (const contract of activeContracts(employee)) {
    if (contract.endDate && contract.endDate < cursor) continue;
    if (contract.startDate > cursor) return false;
    if (!contract.endDate || contract.endDate >= end) return true;
    cursor = addDays(contract.endDate, 1);
  }
  return false;
}

export function contractBreakDays(
  previous: EmployeeContract,
  next: EmployeeContract,
): number {
  return previous.endDate
    ? Math.max(0, daysInclusive(previous.endDate, next.startDate) - 2)
    : 0;
}

export function nextContractStartDate(
  employee: Pick<Employee, 'contracts'>,
): IsoDate | null {
  const latest = resolveLatestContract(employee);
  return latest?.endDate ? addDays(latest.endDate, 1) : null;
}

export function continuationDefaults(
  employee: Pick<Employee, 'contracts' | 'employmentEndEvents'>,
) {
  const latest = resolveLatestContract(employee);
  const closed = latestEmploymentEnd(employee);
  const isClosedSequence =
    Boolean(latest?.endDate) &&
    closed?.sequenceId === latest?.sequenceId &&
    closed?.endDate === latest?.endDate;
  return {
    sequenceId: isClosedSequence
      ? `sequence-${Date.now()}`
      : (latest?.sequenceId ?? `sequence-${Date.now()}`),
    startDate: nextContractStartDate(employee),
  };
}

export function latestEmploymentEnd(
  employee: Pick<Employee, 'employmentEndEvents'>,
): EmploymentEndEvent | null {
  return (
    (employee.employmentEndEvents ?? [])
      .filter((event) => event.status === 'ACTIVE')
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
  );
}

export function requiresContractDecision(
  employee: Pick<Employee, 'contracts' | 'employmentEndEvents'>,
  today = new Date(),
): boolean {
  const latest = resolveLatestContract(employee);
  if (!latest?.endDate || latest.endDate >= isoDate(today)) return false;
  const ended = latestEmploymentEnd(employee);
  return (
    !ended ||
    ended.sequenceId !== latest.sequenceId ||
    ended.endDate !== latest.endDate
  );
}

export function isEmployeeArchived(
  employee: Pick<Employee, 'contracts' | 'employmentEndEvents'>,
  today = new Date(),
): boolean {
  const latest = resolveLatestContract(employee);
  const ended = latestEmploymentEnd(employee);
  return Boolean(
    latest?.endDate &&
    ended &&
    ended.sequenceId === latest.sequenceId &&
    ended.endDate === latest.endDate &&
    ended.endDate < isoDate(today),
  );
}

export interface EmploymentLimitResult {
  cycleStart: IsoDate | null;
  usedDays: number;
  remainingDays: number;
  projectedLimitDate: IsoDate | null;
}

function addCalendarMonths(value: IsoDate, months: number): IsoDate {
  const source = new Date(`${value}T00:00:00.000Z`);
  const day = source.getUTCDate();
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDate(target);
}

export function calculateEmploymentLimit(
  employee: Pick<Employee, 'contracts'>,
  today = new Date(),
): EmploymentLimitResult {
  const todayIso = isoDate(today);
  const contracts = activeContracts(employee).filter(
    (contract) => contract.startDate <= todayIso,
  );
  if (contracts.length === 0) {
    return {
      cycleStart: null,
      usedDays: 0,
      remainingDays: 0,
      projectedLimitDate: null,
    };
  }
  let cycleStart = contracts[0].startDate;
  let cycleContracts: EmployeeContract[] = [];
  let previousEnd: IsoDate | null = null;
  for (const contract of contracts) {
    if (
      previousEnd &&
      contract.startDate >= addCalendarMonths(addDays(previousEnd, 1), 18)
    ) {
      cycleStart = contract.startDate;
      cycleContracts = [];
    }
    cycleContracts.push(contract);
    previousEnd = contract.endDate ?? todayIso;
  }
  const cyclePeriods = mergeEmploymentCoverage(
    cycleContracts.map((contract) => ({
      ...contract,
      endDate:
        !contract.endDate || contract.endDate > todayIso
          ? todayIso
          : contract.endDate,
    })),
  );
  const usedDays = cyclePeriods.reduce(
    (total, period) => total + daysInclusive(period.startDate, period.endDate),
    0,
  );
  const cycleLastDay = addCalendarMonths(cycleStart, 18);
  const cycleAllowanceDays = daysInclusive(cycleStart, cycleLastDay);
  const remainingDays = Math.max(0, cycleAllowanceDays - usedDays);
  const current = resolveCurrentContract(employee, today);
  return {
    cycleStart,
    usedDays,
    remainingDays,
    projectedLimitDate: current ? addDays(todayIso, remainingDays) : null,
  };
}
