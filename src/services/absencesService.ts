import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  runTransaction,
  orderBy,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import {
  findBlockingL4,
  absenceRangesOverlap,
  buildL4ImportPreview,
  l4RowsToCreate,
  normalizeAbsenceCode,
  resolveL4ImportPreviewRow,
  validateAbsenceInput,
  type L4ImportContext,
  type L4ImportPreviewRow,
  type L4ImportSourceRow,
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
import { appendAuditEntryToBatch } from './auditService';
import { dailyValueDocumentId } from './firestore/paths';

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

export interface L4ImportApplyResult {
  created: number;
  skipped: number;
  failed: number;
  rowResults: L4ImportApplyRowResult[];
}

export type L4ImportApplyRowStatus =
  | 'created'
  | 'confirmed-manual'
  | 'duplicate'
  | 'unresolved'
  | 'blocked'
  | 'failed';

export interface L4ImportApplyRowResult {
  rowId: string;
  rowNumber: number;
  status: L4ImportApplyRowStatus;
  message: string;
  ownerMonthId: MonthId | null;
  path: string | null;
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

function ownerMonthIdsForRange(
  startDate: IsoDate,
  endDate: IsoDate,
): MonthId[] {
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

function areConsecutiveAbsenceRanges(
  first: { startDate: IsoDate; endDate: IsoDate },
  second: { startDate: IsoDate; endDate: IsoDate },
): boolean {
  const dayAfterFirst = new Date(`${first.endDate}T00:00:00.000Z`);
  dayAfterFirst.setUTCDate(dayAfterFirst.getUTCDate() + 1);
  const dayAfterSecond = new Date(`${second.endDate}T00:00:00.000Z`);
  dayAfterSecond.setUTCDate(dayAfterSecond.getUTCDate() + 1);
  return (
    dayAfterFirst.toISOString().slice(0, 10) === second.startDate ||
    dayAfterSecond.toISOString().slice(0, 10) === first.startDate
  );
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

export function monthIdFromAbsencePath(path: string): MonthId | null {
  const match = /^months\/([^/]+)\/absences\/[^/]+$/.exec(path);
  return match?.[1] ?? null;
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

async function existingMonthIds(monthIds: MonthId[]): Promise<Set<MonthId>> {
  const { repositories } = requireContext();
  const entries = await Promise.all(
    uniqueMonthIds(monthIds).map(async (monthId) => {
      const snapshot = await getDoc(repositories.forMonth(monthId).month);
      return [monthId, snapshot.exists()] as const;
    }),
  );
  return new Set(
    entries.filter(([, exists]) => exists).map(([monthId]) => monthId),
  );
}

export function ownerMonthIdsForOverlappingDisplay(
  existingMonthIds: readonly MonthId[],
  selectedMonthId: MonthId,
): MonthId[] {
  return uniqueMonthIds(
    existingMonthIds.filter((monthId) => monthId <= selectedMonthId),
  ).sort();
}

async function loadExistingPayrollMonthIds(): Promise<MonthId[]> {
  const { repositories } = requireContext();
  const snapshot = await getDocs(repositories.months);
  return snapshot.docs.map((document) => document.id as MonthId).sort();
}

export async function loadAbsencesOverlappingMonth(
  monthId: MonthId,
): Promise<Absence[]> {
  const range = getPayrollMonthDateRange(monthId);
  const monthStart = dateToIsoDate(range.start);
  const monthEnd = dateToIsoDate(range.end);
  const ownerMonthIds = ownerMonthIdsForOverlappingDisplay(
    await loadExistingPayrollMonthIds(),
    monthId,
  );

  return (await loadAbsencesOwnedByMonths(ownerMonthIds)).filter(
    (absence) => absence.startDate <= monthEnd && absence.endDate >= monthStart,
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

export async function loadL4ImportPreview(
  sourceRows: readonly L4ImportSourceRow[],
): Promise<L4ImportPreviewRow[]> {
  const { repositories } = requireContext();
  const ownerMonths = sourceRows
    .map((row) => row.startDate?.slice(0, 7) ?? null)
    .filter((monthId): monthId is MonthId => Boolean(monthId));
  const sourceDates = sourceRows
    .flatMap((row) => [row.startDate, row.endDate])
    .filter((date): date is IsoDate => Boolean(date));
  const rangeMonths =
    sourceDates.length > 0
      ? ownerMonthIdsForRange(
          sourceDates.reduce((first, date) => (date < first ? date : first)),
          sourceDates.reduce((last, date) => (date > last ? date : last)),
        )
      : [];
  const [employeesSnapshot, existingAbsences, months] = await Promise.all([
    getDocs(query(repositories.employees, orderBy('teta_number'))),
    loadAbsencesOwnedByMonths(uniqueMonthIds([...ownerMonths, ...rangeMonths])),
    existingMonthIds(ownerMonths),
  ]);
  const context: L4ImportContext = {
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    existingAbsences,
    existingMonthIds: months,
  };
  return buildL4ImportPreview(sourceRows, context);
}

export async function resolveL4ImportRowToEmployee(
  row: L4ImportPreviewRow,
  employeeId: string,
): Promise<L4ImportPreviewRow> {
  const { repositories } = requireContext();
  const ownerMonths = row.startDate ? [row.startDate.slice(0, 7)] : [];
  const rangeMonths =
    row.startDate && row.endDate
      ? ownerMonthIdsForRange(row.startDate, row.endDate)
      : [];
  const [employeesSnapshot, existingAbsences, months] = await Promise.all([
    getDocs(query(repositories.employees, orderBy('teta_number'))),
    loadAbsencesOwnedByMonths(uniqueMonthIds([...ownerMonths, ...rangeMonths])),
    existingMonthIds(ownerMonths),
  ]);
  const context: L4ImportContext = {
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    existingAbsences,
    existingMonthIds: months,
  };
  return resolveL4ImportPreviewRow(row, employeeId, context);
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
  const { firestore, repositories, uid } = requireContext();
  const normalized = {
    ...input,
    absenceCode: normalizeAbsenceCode(input.absenceCode),
  };
  assertValidInput(normalized);
  const monthId = ownerMonthId(normalized.startDate);
  await assertWritableMonth(monthId);
  await assertNoBlockingL4(normalized);

  const reference = doc(repositories.forMonth(monthId).absences);
  const batch = writeBatch(firestore);
  batch.set(reference, {
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
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: reference.path,
    action: 'create',
    actorUid: uid,
    changes: {
      employee_id: normalized.employeeId,
      teta_number: normalized.tetaNumber,
      date: normalized.startDate,
      previous_value: null,
      new_value: normalized.absenceCode,
      change_kind:
        normalized.absenceCode === 'L4' ? 'manual-l4-reported' : 'day-absence',
    },
  });
  await batch.commit();
  return reference.id;
}

export async function applyL4ImportRows({
  rows,
  fileName,
}: {
  rows: readonly L4ImportPreviewRow[];
  fileName: string;
}): Promise<L4ImportApplyResult> {
  const { repositories, uid } = requireContext();
  const importId = `l4-${Date.now()}`;
  const result: L4ImportApplyResult = {
    created: 0,
    skipped: 0,
    failed: 0,
    rowResults: [],
  };

  for (const row of rows) {
    if (!isCreatableL4ImportRow(row)) {
      result.skipped += 1;
      result.rowResults.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        status:
          row.status === 'duplicate'
            ? 'duplicate'
            : row.status === 'month-missing'
              ? 'blocked'
              : 'unresolved',
        message: row.message,
        ownerMonthId: row.ownerMonthId,
        path: null,
      });
      continue;
    }
    const employeeId = row.employeeId!;
    const tetaNumber = row.tetaNumber!;
    const startDate = row.startDate!;
    const endDate = row.endDate!;
    const monthId = row.ownerMonthId!;
    try {
      assertValidInput({
        employeeId,
        tetaNumber,
        absenceCode: 'L4',
        startDate,
        endDate,
        hoursPerDay: null,
        note: null,
      });
      await assertWritableMonth(monthId);
      const existing = await loadEmployeeAbsencesForRange(
        employeeId,
        startDate,
        endDate,
      );
      const exactDuplicate = existing.find(
        (absence) =>
          absence.status === 'ACTIVE' &&
          absence.source === 'absence_import' &&
          normalizeAbsenceCode(absence.absenceCode) === 'L4' &&
          absence.startDate === startDate &&
          absence.endDate === endDate,
      );
      if (exactDuplicate) {
        result.skipped += 1;
        result.rowResults.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: 'duplicate',
          message: 'duplicate',
          ownerMonthId: monthId,
          path: `months/${exactDuplicate.monthId}/absences/${exactDuplicate.id}`,
        });
        continue;
      }
      const importedOverlap = existing.some(
        (absence) =>
          absence.status === 'ACTIVE' &&
          absence.source === 'absence_import' &&
          absence.startDate <= endDate &&
          absence.endDate >= startDate,
      );
      if (importedOverlap) {
        result.failed += 1;
        result.rowResults.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: 'blocked',
          message: 'overlap-review',
          ownerMonthId: monthId,
          path: null,
        });
        continue;
      }
      const activeNonL4Overlap = existing.some(
        (absence) =>
          absence.status === 'ACTIVE' &&
          normalizeAbsenceCode(absence.absenceCode) !== 'L4' &&
          absence.startDate <= endDate &&
          absence.endDate >= startDate,
      );
      if (activeNonL4Overlap) {
        result.failed += 1;
        result.rowResults.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: 'blocked',
          message: 'overlap-review',
          ownerMonthId: monthId,
          path: null,
        });
        continue;
      }
      const manualToConfirm = existing.find(
        (absence) =>
          absence.status === 'ACTIVE' &&
          absence.source === 'manual' &&
          absence.monthId === monthId &&
          normalizeAbsenceCode(absence.absenceCode) === 'L4' &&
          (absenceRangesOverlap(absence, { startDate, endDate }) ||
            areConsecutiveAbsenceRanges(absence, { startDate, endDate })),
      );
      if (manualToConfirm) {
        await updateDoc(
          doc(repositories.forMonth(monthId).absences, manualToConfirm.id),
          {
            start_date: startDate,
            end_date: endDate,
            source: 'absence_import',
            import_id: importId,
            note: `L4 import: ${fileName}, wiersz ${row.rowNumber}`,
            updated_at: serverTimestamp(),
            updated_by: uid,
          },
        );
        result.created += 1;
        result.rowResults.push({
          rowId: row.id,
          rowNumber: row.rowNumber,
          status: 'confirmed-manual',
          message: 'confirmed-manual',
          ownerMonthId: monthId,
          path: `months/${monthId}/absences/${manualToConfirm.id}`,
        });
        continue;
      }
      const reference = await addDoc(repositories.forMonth(monthId).absences, {
        employee_id: employeeId,
        teta_number: tetaNumber,
        absence_code: 'L4',
        start_date: startDate,
        end_date: endDate,
        hours_per_day: null,
        source: 'absence_import',
        import_id: importId,
        status: 'ACTIVE',
        note: `L4 import: ${fileName}, wiersz ${row.rowNumber}`,
        created_at: serverTimestamp(),
        created_by: uid,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
      result.created += 1;
      result.rowResults.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        status: 'created',
        message: 'created',
        ownerMonthId: monthId,
        path: `months/${monthId}/absences/${reference.id}`,
      });
    } catch (error) {
      result.failed += 1;
      result.rowResults.push({
        rowId: row.id,
        rowNumber: row.rowNumber,
        status: 'failed',
        message: describeL4ApplyFailure(error),
        ownerMonthId: row.ownerMonthId,
        path: null,
      });
    }
  }

  return result;
}

function isCreatableL4ImportRow(
  row: L4ImportPreviewRow,
): row is L4ImportPreviewRow & {
  employeeId: string;
  tetaNumber: string;
  startDate: IsoDate;
  endDate: IsoDate;
  ownerMonthId: MonthId;
} {
  return l4RowsToCreate([row]).length === 1;
}

function describeL4ApplyFailure(error: unknown): string {
  if (error instanceof AbsenceServiceError) {
    return error.code;
  }
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown-error';
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

export async function saveDayAbsence({
  existingAbsence,
  input,
}: {
  existingAbsence?: Absence | null;
  input: AbsenceCreateInput;
}): Promise<string> {
  if (
    existingAbsence &&
    (existingAbsence.source !== 'manual' ||
      existingAbsence.status !== 'ACTIVE' ||
      existingAbsence.startDate !== existingAbsence.endDate)
  ) {
    throw new AbsenceServiceError('read-only-record');
  }
  const { firestore, repositories, uid } = requireContext();
  const normalized: AbsenceCreateInput = {
    ...input,
    absenceCode: normalizeAbsenceCode(input.absenceCode),
  };
  assertValidInput(normalized, existingAbsence?.monthId);
  const monthId = ownerMonthId(normalized.startDate);
  await assertWritableMonth(monthId);
  await assertNoBlockingL4(normalized, existingAbsence?.id);

  const absenceReference = doc(repositories.forMonth(monthId).absences);
  const previousAbsenceReference = existingAbsence
    ? doc(repositories.forMonth(monthId).absences, existingAbsence.id)
    : null;
  const dailyValueReference = doc(
    repositories.forMonth(monthId).dailyValues,
    dailyValueDocumentId(normalized.employeeId, normalized.startDate),
  );
  const auditReference = doc(repositories.auditLog);

  await runTransaction(firestore, async (transaction) => {
    const dailyValueSnapshot = await transaction.get(dailyValueReference);
    if (
      dailyValueSnapshot.exists() &&
      dailyValueSnapshot.data().source !== 'manual'
    ) {
      throw new AbsenceServiceError('read-only-record');
    }
    if (previousAbsenceReference) {
      transaction.update(previousAbsenceReference, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    }
    if (dailyValueSnapshot.exists()) {
      transaction.delete(dailyValueReference);
    }
    transaction.set(absenceReference, {
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
    transaction.set(auditReference, {
      entity_path: absenceReference.path,
      action:
        existingAbsence || dailyValueSnapshot.exists() ? 'update' : 'create',
      actor_uid: uid,
      occurred_at: serverTimestamp(),
      changes: {
        employee_id: normalized.employeeId,
        teta_number: normalized.tetaNumber,
        date: normalized.startDate,
        previous_value:
          existingAbsence?.absenceCode ??
          (dailyValueSnapshot.exists()
            ? dailyValueSnapshot.data().hours
            : null),
        new_value: normalized.absenceCode,
        change_kind:
          normalized.absenceCode === 'L4'
            ? 'manual-l4-reported'
            : 'hours-to-absence',
      },
    });
  });
  return absenceReference.id;
}

export async function cancelAbsence(absence: Absence): Promise<void> {
  if (absence.source !== 'manual' || absence.status !== 'ACTIVE') {
    throw new AbsenceServiceError('read-only-record');
  }
  const { firestore, repositories, uid } = requireContext();
  await assertWritableMonth(absence.monthId);
  const reference = doc(
    repositories.forMonth(absence.monthId).absences,
    absence.id,
  );
  const batch = writeBatch(firestore);
  batch.update(reference, {
    status: 'CANCELLED',
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  appendAuditEntryToBatch(batch, repositories, {
    entityPath: reference.path,
    action: 'update',
    actorUid: uid,
    changes: {
      employee_id: absence.employeeId,
      teta_number: absence.tetaNumber,
      date: absence.startDate,
      previous_value: absence.absenceCode,
      new_value: null,
      change_kind: 'absence-replacement',
    },
  });
  await batch.commit();
}
