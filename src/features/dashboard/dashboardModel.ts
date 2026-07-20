import type {
  Absence,
  Department,
  Employee,
  EmployeeEntitlement,
  IsoDate,
} from '../../types/firestore';
import {
  absenceCoversDate,
  deriveL4BusinessStatus,
  resolveGoverningAbsence,
} from '../../utils/absences';
import {
  activeContracts,
  aggregateMedicalNotices,
  isEmployeeArchived,
  isDateCoveredByContracts,
  latestEmploymentEnd,
  requiresContractDecision,
  resolveLatestContract,
} from '../../utils/employees';
import {
  currentPayrollMonthId,
  dateToIsoDate,
  formatPayrollMonthId,
  getPayrollMonthDateRange,
  isEmployeeActiveOnDate,
  parsePayrollMonthId,
} from '../../utils/payroll';
import type { MonthReadinessSummary } from '../../utils/readiness';

export interface DashboardDeadline {
  employee: Employee;
  date: Date;
  kind: 'contract' | 'medical';
  remainingDays?: number;
  decisionRequired?: boolean;
}

export interface DashboardDepartmentSummary {
  id: string;
  name: string;
  activeEmployees: number;
  presentEmployees: number;
  employeesOnL4Today: number;
  otherAbsentEmployees: number;
  shiftGroups: {
    red: number;
    white: number;
    blue: number;
    unassigned: number;
  };
}

export interface DashboardAbsenceTrendDay {
  date: Date;
  l4: number;
  vacation: number;
  total: number;
}

export interface DashboardMonthlyRotation {
  monthId: string;
  rate: number;
  hired: number;
  terminated: number;
  averageHeadcount: number;
}

export interface DashboardRotationOverview {
  monthId: string;
  previousMonthId: string;
  total: DashboardMonthlyRotation;
  previousTotal: DashboardMonthlyRotation;
  polish: DashboardMonthlyRotation;
  previousPolish: DashboardMonthlyRotation;
  foreign: DashboardMonthlyRotation;
  previousForeign: DashboardMonthlyRotation;
  unclassified: DashboardMonthlyRotation;
  previousUnclassified: DashboardMonthlyRotation;
}

export interface DashboardSnapshot {
  activeEmployees: Employee[];
  citizenship: {
    polish: number;
    foreign: number;
    missing: number;
  };
  confirmedL4EmployeeIds: Set<string>;
  confirmedL4Today: number;
  unconfirmedL4: number;
  expiringContracts: Employee[];
  medicalRenewals: Employee[];
  expiredMedical: Employee[];
  missingEmployeeData: number;
  departmentSummaries: DashboardDepartmentSummary[];
  accommodation: {
    company: number;
    ownHousing: number;
  };
  absenceTrend: DashboardAbsenceTrendDay[];
  deadlines: DashboardDeadline[];
  rotation: DashboardMonthlyRotation;
}

interface DashboardSnapshotInput {
  employees: readonly Employee[];
  departments: readonly Department[];
  entitlements: readonly EmployeeEntitlement[];
  selectedMonthAbsences: readonly Absence[];
  currentAbsences: readonly Absence[];
  readiness: MonthReadinessSummary | null;
  today?: Date;
}

const DEADLINE_WINDOW_DAYS = 30;

export function buildDashboardSnapshot({
  employees,
  departments,
  entitlements,
  selectedMonthAbsences,
  currentAbsences,
  readiness,
  today = new Date(),
}: DashboardSnapshotInput): DashboardSnapshot {
  const todayIso = dateToIsoDate(today);
  const deadlineEnd = addCalendarDays(today, DEADLINE_WINDOW_DAYS);
  const activeEmployees = employees.filter((employee) =>
    isEmployeeActiveOnDate(employee, today),
  );
  const activeEmployeeIds = new Set(
    activeEmployees.map((employee) => employee.id),
  );
  const confirmedL4EmployeeIds = new Set(
    currentAbsences
      .filter(
        (absence) =>
          activeEmployeeIds.has(absence.employeeId) &&
          absenceCoversDate(absence, todayIso) &&
          deriveL4BusinessStatus(absence, todayIso) === 'ACTIVE',
      )
      .map((absence) => absence.employeeId),
  );
  const todayResolutions = buildAbsenceResolutions(currentAbsences, todayIso);
  const absentEmployeeIds = new Set(
    [...todayResolutions.entries()]
      .filter(
        ([employeeId, resolution]) =>
          activeEmployeeIds.has(employeeId) && resolution.kind !== 'none',
      )
      .map(([employeeId]) => employeeId),
  );
  const unconfirmedL4 = new Set(
    selectedMonthAbsences
      .filter(
        (absence) =>
          absence.status === 'ACTIVE' &&
          deriveL4BusinessStatus(absence, todayIso) === 'REPORTED',
      )
      .map((absence) => absence.employeeId),
  ).size;
  const contractDeadlines = employees
    .filter((employee) => !isEmployeeArchived(employee, today))
    .map((employee) => ({
      employee,
      contract: resolveLatestContract(employee),
      decisionRequired: requiresContractDecision(employee, today),
    }))
    .filter(
      (item) =>
        item.contract?.endDate &&
        (item.decisionRequired ||
          isDateInRange(
            new Date(`${item.contract.endDate}T00:00:00.000Z`),
            today,
            deadlineEnd,
          )),
    );
  const expiringContracts = contractDeadlines
    .filter((item) => !item.decisionRequired)
    .map((item) => item.employee);
  const medical = aggregateMedicalNotices(activeEmployees, departments, today);
  const medicalRenewals = uniqueEmployees([
    ...medical.expired,
    ...medical.expiringSoon,
  ]);
  const missingEmployeeData = new Set(
    readiness?.issues
      .filter(
        (issue) =>
          issue.severity === 'blocking' &&
          issue.target === 'employees' &&
          issue.employeeId,
      )
      .map((issue) => issue.employeeId!) ?? [],
  ).size;
  const departmentsById = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const departmentSummaries = buildDepartmentSummaries(
    activeEmployees,
    departmentsById,
    confirmedL4EmployeeIds,
    absentEmployeeIds,
  );
  const activeEntitlements = entitlements.filter(
    (entitlement) =>
      activeEmployeeIds.has(entitlement.employeeId) &&
      entitlement.status === 'ACTIVE' &&
      entitlement.validFrom <= todayIso &&
      (!entitlement.validTo || entitlement.validTo >= todayIso),
  );
  const upcomingMedical = medical.expiringSoon
    .filter(
      (employee) =>
        employee.medicalValidUntil &&
        isDateInRange(employee.medicalValidUntil, today, deadlineEnd),
    )
    .map((employee): DashboardDeadline => ({
      employee,
      date: employee.medicalValidUntil!,
      kind: 'medical',
    }));
  const deadlines = [
    ...contractDeadlines.map((item): DashboardDeadline => ({
      employee: item.employee,
      date: new Date(`${item.contract!.endDate}T00:00:00.000Z`),
      kind: 'contract',
      remainingDays: calendarDaysBetween(
        today,
        new Date(`${item.contract!.endDate}T00:00:00.000Z`),
      ),
      decisionRequired: item.decisionRequired,
    })),
    ...upcomingMedical,
  ]
    .sort((first, second) => first.date.getTime() - second.date.getTime())
    .slice(0, 6);

  return {
    activeEmployees,
    citizenship: {
      polish: activeEmployees.filter(
        (employee) => employee.citizenship === 'PL',
      ).length,
      foreign: activeEmployees.filter(
        (employee) =>
          Boolean(employee.citizenship) && employee.citizenship !== 'PL',
      ).length,
      missing: activeEmployees.filter((employee) => !employee.citizenship)
        .length,
    },
    confirmedL4EmployeeIds,
    confirmedL4Today: confirmedL4EmployeeIds.size,
    unconfirmedL4,
    expiringContracts,
    medicalRenewals,
    expiredMedical: medical.expired,
    missingEmployeeData,
    departmentSummaries,
    accommodation: {
      company: countEntitlements(activeEntitlements, 'COMPANY_ACCOMMODATION'),
      ownHousing: countEntitlements(
        activeEntitlements,
        'OWN_HOUSING_ALLOWANCE',
      ),
    },
    absenceTrend: buildAbsenceTrend(employees, currentAbsences, today),
    deadlines,
    rotation: calculateMonthlyRotation(employees, today),
  };
}

export function calculateMonthlyRotation(
  employees: readonly Employee[],
  today: Date,
): DashboardMonthlyRotation {
  return calculateRotationForMonth(employees, currentPayrollMonthId(today));
}

export function calculateRotationOverview(
  employees: readonly Employee[],
  monthId: string,
): DashboardRotationOverview {
  const previousMonthId = precedingMonthId(monthId);
  const polishEmployees = employees.filter(
    (employee) => employee.citizenship === 'PL',
  );
  const foreignEmployees = employees.filter(
    (employee) =>
      Boolean(employee.citizenship) && employee.citizenship !== 'PL',
  );
  const unclassifiedEmployees = employees.filter(
    (employee) => !employee.citizenship,
  );

  return {
    monthId,
    previousMonthId,
    total: calculateRotationForMonth(employees, monthId),
    previousTotal: calculateRotationForMonth(employees, previousMonthId),
    polish: calculateRotationForMonth(polishEmployees, monthId),
    previousPolish: calculateRotationForMonth(polishEmployees, previousMonthId),
    foreign: calculateRotationForMonth(foreignEmployees, monthId),
    previousForeign: calculateRotationForMonth(
      foreignEmployees,
      previousMonthId,
    ),
    unclassified: calculateRotationForMonth(unclassifiedEmployees, monthId),
    previousUnclassified: calculateRotationForMonth(
      unclassifiedEmployees,
      previousMonthId,
    ),
  };
}

export function calculateRotationForMonth(
  employees: readonly Employee[],
  monthId: string,
): DashboardMonthlyRotation {
  const { start: monthStart, end: monthEnd } =
    getPayrollMonthDateRange(monthId);
  const startIso = dateToIsoDate(monthStart);
  const endIso = dateToIsoDate(monthEnd);
  const hired = employees.reduce((total, employee) => {
    const sequenceStarts = new Map<string, string>();
    activeContracts(employee).forEach((contract) => {
      const current = sequenceStarts.get(contract.sequenceId);
      if (!current || contract.startDate < current) {
        sequenceStarts.set(contract.sequenceId, contract.startDate);
      }
    });
    return (
      total +
      [...sequenceStarts.values()].filter((date) =>
        isIsoDateInRange(date, startIso, endIso),
      ).length
    );
  }, 0);
  const terminated = employees.filter((employee) => {
    const ending = latestEmploymentEnd(employee);
    if (ending) {
      return isIsoDateInRange(ending.endDate, startIso, endIso);
    }
    return (
      (employee.contracts?.length ?? 0) === 0 &&
      employee.employmentEndDate &&
      isIsoDateInRange(
        dateToIsoDate(employee.employmentEndDate),
        startIso,
        endIso,
      )
    );
  }).length;
  const headcountAtStart = employees.filter((employee) =>
    isDateCoveredByContracts(employee, startIso),
  ).length;
  const headcountAtEnd = employees.filter((employee) =>
    isDateCoveredByContracts(employee, endIso),
  ).length;
  const averageHeadcount = (headcountAtStart + headcountAtEnd) / 2;

  return {
    monthId,
    rate:
      averageHeadcount > 0
        ? Math.round((terminated / averageHeadcount) * 1000) / 10
        : 0,
    hired,
    terminated,
    averageHeadcount,
  };
}

function precedingMonthId(monthId: string): string {
  const { year, month } = parsePayrollMonthId(monthId);
  return month === 1
    ? formatPayrollMonthId(year - 1, 12)
    : formatPayrollMonthId(year, month - 1);
}

function isIsoDateInRange(
  value: IsoDate,
  start: IsoDate,
  end: IsoDate,
): boolean {
  return value >= start && value <= end;
}

function buildDepartmentSummaries(
  employees: readonly Employee[],
  departmentsById: ReadonlyMap<string, string>,
  confirmedL4EmployeeIds: ReadonlySet<string>,
  absentEmployeeIds: ReadonlySet<string>,
): DashboardDepartmentSummary[] {
  const groups = new Map<string, DashboardDepartmentSummary>();
  employees.forEach((employee) => {
    const id = employee.departmentId ?? 'unassigned';
    const group = groups.get(id) ?? {
      id,
      name: employee.departmentId
        ? (departmentsById.get(employee.departmentId) ?? employee.departmentId)
        : '',
      activeEmployees: 0,
      presentEmployees: 0,
      employeesOnL4Today: 0,
      otherAbsentEmployees: 0,
      shiftGroups: {
        red: 0,
        white: 0,
        blue: 0,
        unassigned: 0,
      },
    };
    group.activeEmployees += 1;
    if (confirmedL4EmployeeIds.has(employee.id)) {
      group.employeesOnL4Today += 1;
    } else if (absentEmployeeIds.has(employee.id)) {
      group.otherAbsentEmployees += 1;
    } else {
      group.presentEmployees += 1;
    }
    if (employee.shiftAssignment === 'RED') {
      group.shiftGroups.red += 1;
    } else if (employee.shiftAssignment === 'WHITE') {
      group.shiftGroups.white += 1;
    } else if (employee.shiftAssignment === 'BLUE') {
      group.shiftGroups.blue += 1;
    } else {
      group.shiftGroups.unassigned += 1;
    }
    groups.set(id, group);
  });
  return [...groups.values()].sort(
    (first, second) =>
      second.activeEmployees - first.activeEmployees ||
      first.name.localeCompare(second.name, 'pl-PL'),
  );
}

function buildAbsenceTrend(
  employees: readonly Employee[],
  absences: readonly Absence[],
  today: Date,
): DashboardAbsenceTrendDay[] {
  return Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(today, index - 6),
  ).map((date) => {
    const dateIso = dateToIsoDate(date);
    const activeEmployeeIds = new Set(
      employees
        .filter((employee) => isEmployeeActiveOnDate(employee, date))
        .map((employee) => employee.id),
    );
    const resolutions = buildAbsenceResolutions(absences, dateIso);
    let l4 = 0;
    let vacation = 0;

    resolutions.forEach((resolution, employeeId) => {
      if (
        !activeEmployeeIds.has(employeeId) ||
        resolution.kind !== 'governed'
      ) {
        return;
      }
      if (resolution.code === 'L4' && resolution.confirmation === 'confirmed') {
        l4 += 1;
      } else if (resolution.code === 'UW' || resolution.code === 'UZ') {
        vacation += 1;
      }
    });

    return { date, l4, vacation, total: l4 + vacation };
  });
}

function buildAbsenceResolutions(absences: readonly Absence[], date: IsoDate) {
  const byEmployee = new Map<string, Absence[]>();
  absences.forEach((absence) => {
    if (absence.status !== 'ACTIVE' || !absenceCoversDate(absence, date)) {
      return;
    }
    const employeeAbsences = byEmployee.get(absence.employeeId) ?? [];
    employeeAbsences.push(absence);
    byEmployee.set(absence.employeeId, employeeAbsences);
  });
  return new Map(
    [...byEmployee.entries()].map(([employeeId, employeeAbsences]) => [
      employeeId,
      resolveGoverningAbsence(employeeAbsences, date),
    ]),
  );
}

function countEntitlements(
  entitlements: readonly EmployeeEntitlement[],
  type: EmployeeEntitlement['type'],
) {
  return new Set(
    entitlements
      .filter((entitlement) => entitlement.type === type)
      .map((entitlement) => entitlement.employeeId),
  ).size;
}

function uniqueEmployees(employees: readonly Employee[]): Employee[] {
  return employees.filter(
    (employee, index, all) =>
      all.findIndex((candidate) => candidate.id === employee.id) === index,
  );
}

function isDateInRange(value: Date, start: Date, end: Date): boolean {
  const day = dateAtUtcMidnight(value);
  return day >= dateAtUtcMidnight(start) && day <= dateAtUtcMidnight(end);
}

function addCalendarDays(value: Date, days: number): Date {
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate() + days),
  );
}

function calendarDaysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.ceil((endUtc - startUtc) / 86_400_000);
}

function dateAtUtcMidnight(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}
