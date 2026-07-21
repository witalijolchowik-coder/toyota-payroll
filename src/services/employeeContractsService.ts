import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  Employee,
  EmployeeContract,
  EmployeeContractCreateInput,
  EmployeeContractUpdateInput,
  EmployeeId,
  EmploymentEndCreateInput,
  IsoDate,
  MonthId,
} from '../types/firestore';
import {
  activeContracts,
  planLegacyContractMigration,
  resolveLatestContract,
  validateEmployeeContract,
} from '../utils/employees';
import { mapMonthDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { appendAuditEntryToBatch } from './auditService';

export type EmployeeContractServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'employee-not-found'
  | 'invalid-contract'
  | 'duplicate-contract'
  | 'overlapping-contract'
  | 'locked-month'
  | 'invalid-employment-end';

export class EmployeeContractServiceError extends Error {
  constructor(
    readonly code: EmployeeContractServiceErrorCode,
    readonly details: string[] = [],
  ) {
    super(code);
    this.name = 'EmployeeContractServiceError';
  }
}

export interface EmployeeContractImpact {
  openMonths: MonthId[];
  lockedMonths: MonthId[];
}

function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new EmployeeContractServiceError('firebase-unavailable');
  }
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new EmployeeContractServiceError('authentication-required');
  }
  return { repositories, uid };
}

function impactedMonthIds(
  startDate: IsoDate,
  endDate: IsoDate | null,
): MonthId[] {
  const end = endDate ?? startDate;
  const cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00.000Z`);
  const limit = new Date(`${end.slice(0, 7)}-01T00:00:00.000Z`);
  const result: MonthId[] = [];
  while (cursor <= limit) {
    result.push(cursor.toISOString().slice(0, 7) as MonthId);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

async function monthImpactForPeriods(
  periods: Array<{ startDate: IsoDate; endDate: IsoDate | null }>,
): Promise<{ open: MonthId[]; locked: MonthId[] }> {
  const { repositories } = requireContext();
  const snapshot = await getDocs(repositories.months);
  const affected = snapshot.docs
    .map((month) => mapMonthDocument(month.id, month.data()))
    .filter((month) => {
      const monthStart = month.id + '-01';
      const monthEnd = month.monthEnd.toISOString().slice(0, 10);
      return periods.some(
        (period) =>
          period.startDate <= monthEnd &&
          (period.endDate ?? '9999-12-31') >= monthStart,
      );
    });
  return {
    open: affected
      .filter((month) => !month.isSettled)
      .map((month) => month.id)
      .sort(),
    locked: affected
      .filter((month) => month.isSettled)
      .map((month) => month.id)
      .sort(),
  };
}

export async function previewEmployeeContractImpact(
  periods: Array<{ startDate: IsoDate; endDate: IsoDate | null }>,
): Promise<EmployeeContractImpact> {
  const impact = await monthImpactForPeriods(periods);
  return {
    openMonths: impact.open,
    lockedMonths: impact.locked,
  };
}

function throwValidation(
  candidate: Pick<EmployeeContract, 'id' | 'startDate' | 'endDate'>,
  contracts: readonly EmployeeContract[],
) {
  const issue = validateEmployeeContract(candidate, contracts)[0];
  if (!issue) return;
  if (issue.code === 'duplicate') {
    throw new EmployeeContractServiceError('duplicate-contract', [
      issue.conflictingContractId ?? '',
    ]);
  }
  if (issue.code === 'overlap') {
    throw new EmployeeContractServiceError('overlapping-contract', [
      issue.conflictingContractId ?? '',
    ]);
  }
  throw new EmployeeContractServiceError('invalid-contract');
}

export async function createEmployeeContract(
  employee: Employee,
  input: Omit<EmployeeContractCreateInput, 'employeeId' | 'tetaNumber'>,
): Promise<string> {
  const { repositories, uid } = requireContext();
  throwValidation(
    { id: '', startDate: input.startDate, endDate: input.endDate },
    activeContracts(employee),
  );
  const impact = await monthImpactForPeriods([input]);
  if (impact.locked.length > 0) {
    throw new EmployeeContractServiceError('locked-month', impact.locked);
  }
  const reference = doc(repositories.employeeContracts);
  const batch = writeBatch(repositories.employeeContracts.firestore);
  batch.set(reference, {
    employee_id: employee.id,
    teta_number: employee.tetaNumber,
    sequence_id: input.sequenceId,
    start_date: input.startDate,
    end_date: input.endDate,
    status: 'ACTIVE',
    note: input.note,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  const allContracts = [
    ...activeContracts(employee),
    {
      id: reference.id,
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      sequenceId: input.sequenceId,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'ACTIVE' as const,
      note: input.note,
      createdAt: new Date(),
      createdBy: uid,
      updatedAt: new Date(),
      updatedBy: uid,
    },
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const first = allContracts[0];
  const last = allContracts.at(-1)!;
  batch.update(repositories.employee(employee.id), {
    employment_start_date: first
      ? Timestamp.fromDate(new Date(`${first.startDate}T00:00:00.000Z`))
      : null,
    employment_end_date: last.endDate
      ? Timestamp.fromDate(new Date(`${last.endDate}T00:00:00.000Z`))
      : null,
    is_active: true,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  impact.open.forEach((monthId) => {
    batch.update(repositories.forMonth(monthId).month, {
      calculation_status: 'queued',
      calculation_input_hash: null,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employeeContracts/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      operation: 'employee-contract-created',
      employee_id: employee.id,
      sequence_id: input.sequenceId,
      start_date: input.startDate,
      end_date: input.endDate,
      affected_open_months: impact.open,
    },
  });
  await batch.commit();
  return reference.id;
}

export async function updateEmployeeContract(
  employee: Employee,
  contract: EmployeeContract,
  input: EmployeeContractUpdateInput,
): Promise<void> {
  const { repositories, uid } = requireContext();
  throwValidation(
    { id: contract.id, startDate: input.startDate, endDate: input.endDate },
    activeContracts(employee),
  );
  const impact = await monthImpactForPeriods([
    contract,
    { startDate: input.startDate, endDate: input.endDate },
  ]);
  if (impact.locked.length > 0) {
    throw new EmployeeContractServiceError('locked-month', impact.locked);
  }
  const batch = writeBatch(repositories.employeeContracts.firestore);
  batch.update(repositories.employeeContract(contract.id), {
    start_date: input.startDate,
    end_date: input.endDate,
    note: input.note,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  const updatedContracts = activeContracts(employee)
    .map((item) =>
      item.id === contract.id
        ? { ...item, startDate: input.startDate, endDate: input.endDate }
        : item,
    )
    .sort((first, second) => first.startDate.localeCompare(second.startDate));
  const first = updatedContracts[0];
  const last = updatedContracts.at(-1);
  batch.update(repositories.employee(employee.id), {
    employment_start_date: first
      ? Timestamp.fromDate(new Date(`${first.startDate}T00:00:00.000Z`))
      : null,
    employment_end_date: last?.endDate
      ? Timestamp.fromDate(new Date(`${last.endDate}T00:00:00.000Z`))
      : null,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  impact.open.forEach((monthId) => {
    batch.update(repositories.forMonth(monthId).month, {
      calculation_status: 'queued',
      calculation_input_hash: null,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employeeContracts/${contract.id}`,
    action: 'update',
    actorUid: uid,
    changes: {
      operation: 'employee-contract-updated',
      before: {
        start_date: contract.startDate,
        end_date: contract.endDate,
        note: contract.note,
      },
      after: input,
      affected_months: [
        ...new Set([
          ...impactedMonthIds(contract.startDate, contract.endDate),
          ...impactedMonthIds(input.startDate, input.endDate),
        ]),
      ].sort(),
      affected_open_months: impact.open,
    },
  });
  await batch.commit();
}

export async function cancelEmployeeContract(
  employee: Employee,
  contract: EmployeeContract,
): Promise<void> {
  const { repositories, uid } = requireContext();
  const impact = await monthImpactForPeriods([contract]);
  if (impact.locked.length > 0) {
    throw new EmployeeContractServiceError('locked-month', impact.locked);
  }
  const batch = writeBatch(repositories.employeeContracts.firestore);
  batch.update(repositories.employeeContract(contract.id), {
    status: 'CANCELLED',
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  const remainingContracts = activeContracts(employee)
    .filter((item) => item.id !== contract.id)
    .sort((first, second) => first.startDate.localeCompare(second.startDate));
  const first = remainingContracts[0];
  const last = remainingContracts.at(-1);
  batch.update(repositories.employee(employee.id), {
    employment_start_date: first
      ? Timestamp.fromDate(new Date(`${first.startDate}T00:00:00.000Z`))
      : null,
    employment_end_date: last?.endDate
      ? Timestamp.fromDate(new Date(`${last.endDate}T00:00:00.000Z`))
      : null,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  impact.open.forEach((monthId) => {
    batch.update(repositories.forMonth(monthId).month, {
      calculation_status: 'queued',
      calculation_input_hash: null,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employeeContracts/${contract.id}`,
    action: 'delete',
    actorUid: uid,
    changes: {
      operation: 'employee-contract-cancelled',
      employee_id: employee.id,
      affected_months: impactedMonthIds(contract.startDate, contract.endDate),
      affected_open_months: impact.open,
    },
  });
  await batch.commit();
}

export async function endEmployeeEmployment(
  employee: Employee,
  input: Omit<EmploymentEndCreateInput, 'employeeId' | 'tetaNumber'>,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const latest = resolveLatestContract(employee);
  if (
    !latest?.endDate ||
    latest.sequenceId !== input.sequenceId ||
    latest.endDate !== input.endDate
  ) {
    throw new EmployeeContractServiceError('invalid-employment-end');
  }
  const impact = await monthImpactForPeriods([latest]);
  if (impact.locked.length > 0) {
    throw new EmployeeContractServiceError('locked-month', impact.locked);
  }
  const reference = doc(repositories.employmentEndEvents);
  const batch = writeBatch(repositories.employmentEndEvents.firestore);
  batch.set(reference, {
    employee_id: employee.id,
    teta_number: employee.tetaNumber,
    sequence_id: input.sequenceId,
    end_date: input.endDate,
    status: 'ACTIVE',
    reason: input.reason,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  batch.update(repositories.employee(employee.id), {
    is_active: input.endDate >= new Date().toISOString().slice(0, 10),
    employment_end_date: Timestamp.fromDate(
      new Date(`${input.endDate}T00:00:00.000Z`),
    ),
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  impact.open.forEach((monthId) => {
    batch.update(repositories.forMonth(monthId).month, {
      calculation_status: 'queued',
      calculation_input_hash: null,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employmentEndEvents/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      operation: 'employment-explicitly-ended',
      employee_id: employee.id,
      sequence_id: input.sequenceId,
      end_date: input.endDate,
      reason: input.reason,
      deposit_return_required: true,
      affected_open_months: impact.open,
    },
  });
  await batch.commit();
  return reference.id;
}

export async function bootstrapLegacyEmployeeContract(
  employee: Employee,
): Promise<string | null> {
  const migration = planLegacyContractMigration(employee);
  if (!migration) return null;
  const { repositories, uid } = requireContext();
  const reference = repositories.employeeContract(migration.contractId);
  const batch = writeBatch(repositories.employeeContracts.firestore);
  batch.set(reference, {
    employee_id: employee.id,
    teta_number: employee.tetaNumber,
    sequence_id: migration.sequenceId,
    start_date: migration.startDate,
    end_date: migration.endDate,
    status: 'ACTIVE',
    note: 'Migracja z historycznych dat zatrudnienia',
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  batch.update(repositories.employee(employee.id), {
    is_active: migration.restoreOperationalActive ? true : employee.isActive,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employeeContracts/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      operation: 'legacy-employment-period-migrated',
      legacy_auto_archive_repaired: migration.restoreOperationalActive,
      employee_id: employee.id,
      start_date: migration.startDate,
      end_date: migration.endDate,
    },
  });
  await batch.commit();
  return reference.id;
}

export async function employeeExists(employeeId: EmployeeId): Promise<boolean> {
  const { repositories } = requireContext();
  return (await getDoc(repositories.employee(employeeId))).exists();
}
