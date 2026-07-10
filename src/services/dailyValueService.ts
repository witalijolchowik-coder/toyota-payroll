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

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);

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
        return;
      }

      transaction.update(reference, {
        hours: input.hours,
        note: input.note,
        work_time_correction: workTimeCorrection,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
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

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const operation = resolveManualAttendanceClearOperation(
      snapshot.exists()
        ? {
            source: snapshot.data().source,
            manualOverride: dailyValueManualOverride(snapshot.data()),
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
      return;
    }
    if (operation === 'delete-manual-daily-value') {
      transaction.delete(reference);
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
