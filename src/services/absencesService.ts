import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  orderBy,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import {
  findBlockingL4,
  normalizeAbsenceCode,
  validateAbsenceInput,
} from '../utils/absences';
import {
  currentPayrollMonthId,
  dateToIsoDate,
  getPayrollMonthDateRange,
} from '../utils/payroll';
import type {
  Absence,
  AbsenceCreateInput,
  AbsenceUpdateInput,
  Employee,
  IsoDate,
  MonthId,
  PayrollMonth,
} from '../types/firestore';
import {
  mapAbsenceDocument,
  mapEmployeeDocument,
  mapMonthDocument,
} from './firestore/mappers';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';

export type AbsenceServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'month-unavailable'
  | 'month-settled'
  | 'l4-overlap'
  | 'ownership-month-change'
  | 'read-only-record';

export class AbsenceServiceError extends Error {
  constructor(readonly code: AbsenceServiceErrorCode) {
    super(code);
    this.name = 'AbsenceServiceError';
  }
}

export interface AbsenceWorkspaceData {
  absences: Absence[];
  currentAbsences: Absence[];
  employees: Employee[];
  month: PayrollMonth | null;
}

function requireContext() {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new AbsenceServiceError('firebase-unavailable');
  }
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new AbsenceServiceError('authentication-required');
  }
  return { firestore, repositories, uid };
}

function ownerMonthId(startDate: IsoDate): MonthId {
  return startDate.slice(0, 7);
}

function addMonths(monthId: MonthId, offset: number): MonthId {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function uniqueMonthIds(monthIds: MonthId[]): MonthId[] {
  return [...new Set(monthIds)];
}

function ownerMonthIdsForDisplay(monthId: MonthId): MonthId[] {
  return uniqueMonthIds([addMonths(monthId, -1), monthId]);
}

function ownerMonthIdsForRange(startDate: IsoDate, endDate: IsoDate): MonthId[] {
  const startMonth = addMonths(ownerMonthId(startDate), -1);
  const endMonth = ownerMonthId(endDate);
  const result: MonthId[] = [];
  let current = startMonth;

  while (current <= endMonth) {
    result.push(current);
    current = addMonths(current, 1);
  }

  return uniqueMonthIds(result);
}

async function loadAbsencesOwnedByMonths(
  monthIds: MonthId[],
): Promise<Absence[]> {
  const { repositories } = requireContext();
  const snapshots = await Promise.all(
    uniqueMonthIds(monthIds).map(async (monthId) => ({
      monthId,
      snapshot: await getDocs(repositories.forMonth(monthId).absences),
    })),
  );

  return snapshots
    .flatMap(({ monthId, snapshot }) =>
      snapshot.docs.map((document) =>
        mapAbsenceDocument(document.id, monthId, document.data()),
      ),
    )
    .sort((first, second) =>
      first.startDate === second.startDate
        ? first.tetaNumber.localeCompare(second.tetaNumber, 'pl-PL')
        : first.startDate.localeCompare(second.startDate),
    );
}

async function assertWritableMonth(monthId: MonthId) {
  const { repositories } = requireContext();
  const snapshot = await getDoc(repositories.forMonth(monthId).month);
  if (!snapshot.exists()) {
    throw new AbsenceServiceError('month-unavailable');
  }
  if (snapshot.data().is_settled) {
    throw new AbsenceServiceError('month-settled');
  }
}

export async function loadAbsencesOverlappingMonth(
  monthId: MonthId,
): Promise<Absence[]> {
  const range = getPayrollMonthDateRange(monthId);
  const monthStart = dateToIsoDate(range.start);
  const monthEnd = dateToIsoDate(range.end);

  return (await loadAbsencesOwnedByMonths(ownerMonthIdsForDisplay(monthId)))
    .filter(
      (absence) =>
        absence.startDate <= monthEnd && absence.endDate >= monthStart,
    );
}

async function loadEmployeeAbsencesForRange(
  employeeId: string,
  startDate: IsoDate,
  endDate: IsoDate,
): Promise<Absence[]> {
  return (
    await loadAbsencesOwnedByMonths(ownerMonthIdsForRange(startDate, endDate))
  ).filter(
    (absence) =>
      absence.employeeId === employeeId &&
      absence.startDate <= endDate &&
      absence.endDate >= startDate,
  );
}

export async function loadAbsenceWorkspace(
  selectedMonthId: MonthId,
): Promise<AbsenceWorkspaceData> {
  const { repositories } = requireContext();
  const currentMonthId = currentPayrollMonthId(new Date());
  const monthRepository = repositories.forMonth(selectedMonthId);
  const [monthSnapshot, employeesSnapshot, absences, currentAbsences] =
    await Promise.all([
      getDoc(monthRepository.month),
      getDocs(query(repositories.employees, orderBy('teta_number'))),
      loadAbsencesOverlappingMonth(selectedMonthId),
      selectedMonthId === currentMonthId
        ? Promise.resolve(null)
        : loadAbsencesOverlappingMonth(currentMonthId),
    ]);

  return {
    month: monthSnapshot.exists()
      ? mapMonthDocument(selectedMonthId, monthSnapshot.data())
      : null,
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    absences,
    currentAbsences: currentAbsences ?? absences,
  };
}

function assertValidInput(
  input: AbsenceCreateInput,
  existingOwnerMonthId?: MonthId,
) {
  const errors = validateAbsenceInput(
    {
      employeeId: input.employeeId,
      absenceCode: input.absenceCode,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    existingOwnerMonthId,
  );
  if (errors.startDate === 'ownership-month-change') {
    throw new AbsenceServiceError('ownership-month-change');
  }
  if (Object.keys(errors).length > 0) {
    throw new AbsenceServiceError('invalid-input');
  }
}

async function assertNoBlockingL4(
  input: AbsenceCreateInput,
  ignoredAbsenceId?: string,
) {
  const existing = await loadEmployeeAbsencesForRange(
    input.employeeId,
    input.startDate,
    input.endDate,
  );
  if (
    findBlockingL4(
      existing,
      {
        employeeId: input.employeeId,
        absenceCode: input.absenceCode,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      ignoredAbsenceId,
    )
  ) {
    throw new AbsenceServiceError('l4-overlap');
  }
}

export async function createAbsence(
  input: AbsenceCreateInput,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const normalized = {
    ...input,
    absenceCode: normalizeAbsenceCode(input.absenceCode),
  };
  assertValidInput(normalized);
  const monthId = ownerMonthId(normalized.startDate);
  await assertWritableMonth(monthId);
  await assertNoBlockingL4(normalized);

  const reference = await addDoc(repositories.forMonth(monthId).absences, {
    employee_id: normalized.employeeId,
    teta_number: normalized.tetaNumber,
    absence_code: normalized.absenceCode,
    start_date: normalized.startDate,
    end_date: normalized.endDate,
    hours_per_day: null,
    source: 'manual',
    import_id: null,
    status: 'ACTIVE',
    note: normalized.note,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  return reference.id;
}

export async function updateAbsence(
  absence: Absence,
  input: AbsenceUpdateInput,
): Promise<void> {
  if (absence.source !== 'manual' || absence.status !== 'ACTIVE') {
    throw new AbsenceServiceError('read-only-record');
  }
  const { repositories, uid } = requireContext();
  const normalized: AbsenceCreateInput = {
    employeeId: absence.employeeId,
    tetaNumber: absence.tetaNumber,
    absenceCode: normalizeAbsenceCode(input.absenceCode),
    startDate: input.startDate,
    endDate: input.endDate,
    hoursPerDay: null,
    note: input.note,
  };
  assertValidInput(normalized, absence.monthId);
  await assertWritableMonth(absence.monthId);
  await assertNoBlockingL4(normalized, absence.id);

  await updateDoc(
    doc(repositories.forMonth(absence.monthId).absences, absence.id),
    {
      absence_code: normalized.absenceCode,
      start_date: normalized.startDate,
      end_date: normalized.endDate,
      hours_per_day: null,
      note: normalized.note,
      updated_at: serverTimestamp(),
      updated_by: uid,
    },
  );
}

export async function cancelAbsence(absence: Absence): Promise<void> {
  if (absence.source !== 'manual' || absence.status !== 'ACTIVE') {
    throw new AbsenceServiceError('read-only-record');
  }
  const { repositories, uid } = requireContext();
  await assertWritableMonth(absence.monthId);
  await updateDoc(
    doc(repositories.forMonth(absence.monthId).absences, absence.id),
    {
      status: 'CANCELLED',
      updated_at: serverTimestamp(),
      updated_by: uid,
    },
  );
}
