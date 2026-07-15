import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { auth } from '../config/firebase';
import { dailyValueDocumentId } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import type {
  DailyValueDocument,
  DailyValueUpsertInput,
  Absence,
  EmployeeId,
  IsoDate,
  MonthId,
  WorkTimeCorrectionInput,
} from '../types/firestore';
import {
  isValidWorkedHours,
  resolveManualAttendanceClearOperation,
} from '../utils/attendance';
import { isValidClockTime } from '../utils/payroll';

export type DailyValueServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'invalid-hours';

export class DailyValueServiceError extends Error {
  constructor(readonly code: DailyValueServiceErrorCode) {
    super(code);
    this.name = 'DailyValueServiceError';
  }
}

function workTimeCorrectionPayload(
  input: WorkTimeCorrectionInput | null | undefined,
  actorUid: string,
) {
  if (!input) {
    return null;
  }
  if (
    !isValidClockTime(input.plannedStartTime) ||
    !isValidClockTime(input.plannedEndTime) ||
    !isValidClockTime(input.actualStartTime) ||
    !isValidClockTime(input.actualEndTime)
  ) {
    throw new DailyValueServiceError('invalid-hours');
  }

  return {
    planned_shift: input.plannedShift,
    planned_start_time: input.plannedStartTime,
    planned_end_time: input.plannedEndTime,
    actual_start_time: input.actualStartTime,
    actual_end_time: input.actualEndTime,
    classification_override: input.classificationOverride
      ? {
          private_time_hours: input.classificationOverride.privateTimeHours,
          overtime_50_hours: input.classificationOverride.overtime50Hours,
          overtime_100_hours: input.classificationOverride.overtime100Hours,
          coverable_ni_hours: input.classificationOverride.coverableNiHours,
          note: input.classificationOverride.note,
          actor_uid: actorUid,
          updated_at: serverTimestamp(),
        }
      : null,
  };
}

function auditWorkTimeCorrection(
  input: WorkTimeCorrectionInput | null | undefined,
) {
  if (!input) return null;
  return {
    planned_shift: input.plannedShift,
    planned_start_time: input.plannedStartTime,
    planned_end_time: input.plannedEndTime,
    actual_start_time: input.actualStartTime,
    actual_end_time: input.actualEndTime,
    classification_override: input.classificationOverride ?? null,
  };
}

async function requireActorUid(): Promise<string> {
  if (!auth) {
    throw new DailyValueServiceError('firebase-unavailable');
  }

  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new DailyValueServiceError('authentication-required');
  }
  return uid;
}

function assertHours(hours: number) {
  if (!isValidWorkedHours(hours)) {
    throw new DailyValueServiceError('invalid-hours');
  }
}

export async function saveManualDailyValue(
  monthId: MonthId,
  input: DailyValueUpsertInput,
  absenceToCancel: Absence | null = null,
): Promise<void> {
  assertHours(input.hours);
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new DailyValueServiceError('firebase-unavailable');
  }

  const actorUid = await requireActorUid();
  const workTimeCorrection = workTimeCorrectionPayload(
    input.workTimeCorrection,
    actorUid,
  );
  const dailyValues = repositories.forMonth(monthId).dailyValues;
  const reference = doc(
    dailyValues,
    dailyValueDocumentId(input.employeeId, input.date),
  );
  const auditReference = doc(repositories.auditLog);
  if (
    absenceToCancel &&
    (absenceToCancel.source !== 'manual' ||
      absenceToCancel.status !== 'ACTIVE' ||
      absenceToCancel.startDate !== absenceToCancel.endDate ||
      absenceToCancel.startDate !== input.date)
  ) {
    throw new DailyValueServiceError('invalid-hours');
  }
  const absenceReference = absenceToCancel
    ? doc(
        repositories.forMonth(absenceToCancel.monthId).absences,
        absenceToCancel.id,
      )
    : null;

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (absenceReference) {
      transaction.update(absenceReference, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
    }

    if (snapshot.exists()) {
      if (snapshot.data().source === 'attendance_import') {
        transaction.update(reference, {
          manual_override: {
            hours: input.hours,
            note: input.note,
            actor_uid: actorUid,
            updated_at: serverTimestamp(),
          },
          work_time_correction: workTimeCorrection,
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        });
        transaction.set(auditReference, {
          entity_path: reference.path,
          action: 'update',
          actor_uid: actorUid,
          occurred_at: serverTimestamp(),
          changes: {
            date: input.date,
            employee_id: input.employeeId,
            teta_number: input.tetaNumber,
            previous_hours:
              snapshot.data().manual_override?.hours ?? snapshot.data().hours,
            new_hours: input.hours,
            change_kind: 'actual-hours-override',
            previous_work_time_correction:
              snapshot.data().work_time_correction ?? null,
            new_work_time_correction: auditWorkTimeCorrection(
              input.workTimeCorrection,
            ),
            replaced_absence: absenceToCancel?.absenceCode ?? null,
          },
        });
        return;
      }

      transaction.update(reference, {
        hours: input.hours,
        note: input.note,
        work_time_correction: workTimeCorrection,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
      transaction.set(auditReference, {
        entity_path: reference.path,
        action: 'update',
        actor_uid: actorUid,
        occurred_at: serverTimestamp(),
        changes: {
          date: input.date,
          employee_id: input.employeeId,
          teta_number: input.tetaNumber,
          previous_hours: snapshot.data().hours,
          new_hours: input.hours,
          change_kind: 'actual-hours',
          previous_work_time_correction:
            snapshot.data().work_time_correction ?? null,
          new_work_time_correction: auditWorkTimeCorrection(
            input.workTimeCorrection,
          ),
          replaced_absence: absenceToCancel?.absenceCode ?? null,
        },
      });
      return;
    }

    transaction.set(reference, {
      employee_id: input.employeeId,
      teta_number: input.tetaNumber,
      date: input.date,
      hours: input.hours,
      source: 'manual',
      import_id: null,
      note: input.note,
      manual_override: null,
      work_time_correction: workTimeCorrection,
      created_at: serverTimestamp(),
      created_by: actorUid,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    transaction.set(auditReference, {
      entity_path: reference.path,
      action: 'create',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        date: input.date,
        employee_id: input.employeeId,
        teta_number: input.tetaNumber,
        previous_hours: null,
        new_hours: input.hours,
        change_kind: 'actual-hours',
        previous_work_time_correction: null,
        new_work_time_correction: auditWorkTimeCorrection(
          input.workTimeCorrection,
        ),
        replaced_absence: absenceToCancel?.absenceCode ?? null,
      },
    });
  });
}

export async function clearManualDailyValue(
  monthId: MonthId,
  employeeId: EmployeeId,
  date: IsoDate,
): Promise<void> {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new DailyValueServiceError('firebase-unavailable');
  }

  const actorUid = await requireActorUid();
  const dailyValues = repositories.forMonth(monthId).dailyValues;
  const reference = doc(dailyValues, dailyValueDocumentId(employeeId, date));
  const auditReference = doc(repositories.auditLog);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existingDocument = snapshot.exists() ? snapshot.data() : null;
    const operation = resolveManualAttendanceClearOperation(
      existingDocument
        ? {
            source: existingDocument.source,
            manualOverride: dailyValueManualOverride(existingDocument),
          }
        : null,
    );
    if (operation === 'clear-imported-override') {
      transaction.update(reference, {
        manual_override: null,
        work_time_correction: null,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
      transaction.set(auditReference, {
        entity_path: reference.path,
        action: 'update',
        actor_uid: actorUid,
        occurred_at: serverTimestamp(),
        changes: {
          date,
          employee_id: employeeId,
          previous_hours: existingDocument?.manual_override?.hours ?? null,
          new_hours: existingDocument?.hours ?? null,
          change_kind: 'clear-manual-override',
        },
      });
      return;
    }
    if (operation === 'delete-manual-daily-value') {
      transaction.delete(reference);
      transaction.set(auditReference, {
        entity_path: reference.path,
        action: 'delete',
        actor_uid: actorUid,
        occurred_at: serverTimestamp(),
        changes: {
          date,
          employee_id: employeeId,
          previous_hours: existingDocument?.hours ?? null,
          new_hours: null,
          change_kind: 'clear-manual-value',
        },
      });
    }
  });
}

function dailyValueManualOverride(document: DailyValueDocument) {
  return document.manual_override
    ? {
        hours: document.manual_override.hours,
        note: document.manual_override.note,
        actorUid: document.manual_override.actor_uid,
        updatedAt: document.manual_override.updated_at.toDate(),
      }
    : null;
}
