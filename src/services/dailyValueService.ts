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

export type DailyValueServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'imported-read-only'
  | 'invalid-hours';

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
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
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
    if (snapshot.exists() && snapshot.data().source !== 'manual') {
      throw new DailyValueServiceError('imported-read-only');
    }

    if (snapshot.exists()) {
      transaction.update(reference, {
        hours: input.hours,
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

  await requireActorUid();
  const dailyValues = repositories.forMonth(monthId).dailyValues;
  const reference = doc(dailyValues, dailyValueDocumentId(employeeId, date));

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) {
      return;
    }
    if (snapshot.data().source !== 'manual') {
      throw new DailyValueServiceError('imported-read-only');
    }
    transaction.delete(reference);
  });
}
