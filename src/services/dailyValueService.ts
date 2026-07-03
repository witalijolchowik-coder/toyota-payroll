import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { auth } from '../config/firebase';
import { dailyValueDocumentId } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import type {
  DailyValueUpsertInput,
  EmployeeId,
  IsoDate,
  MonthId,
} from '../types/firestore';
import { isValidWorkedHours } from '../utils/attendance';

export type DailyValueServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'invalid-hours';

export class DailyValueServiceError extends Error {
  constructor(readonly code: DailyValueServiceErrorCode) {
    super(code);
    this.name = 'DailyValueServiceError';
  }
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
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        });
        return;
      }

      transaction.update(reference, {
        hours: input.hours,
        note: input.note,
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
    if (!snapshot.exists()) {
      return;
    }
    if (snapshot.data().source === 'attendance_import') {
      if (!snapshot.data().manual_override) {
        return;
      }
      transaction.update(reference, {
        manual_override: null,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
      return;
    }
    transaction.delete(reference);
  });
}
