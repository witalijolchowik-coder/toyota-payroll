import {
  Timestamp,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import { getMonthDateRange } from '../features/settlement/monthUtils';
import type {
  DailyValue,
  Employee,
  MonthId,
  PayrollMonth,
} from '../types/firestore';
import {
  mapDailyValueDocument,
  mapEmployeeDocument,
  mapMonthDocument,
} from './firestore/mappers';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';

export type SettlementServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'month-unavailable';

export class SettlementServiceError extends Error {
  constructor(readonly code: SettlementServiceErrorCode) {
    super(code);
    this.name = 'SettlementServiceError';
  }
}

export interface SettlementMonthData {
  month: PayrollMonth;
  employees: Employee[];
  dailyValues: DailyValue[];
}

async function requireActorUid(): Promise<string> {
  if (!auth) {
    throw new SettlementServiceError('firebase-unavailable');
  }

  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new SettlementServiceError('authentication-required');
  }
  return uid;
}

export async function loadOrCreateSettlementMonth(
  monthId: MonthId,
): Promise<SettlementMonthData> {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new SettlementServiceError('firebase-unavailable');
  }

  const actorUid = await requireActorUid();
  const range = getMonthDateRange(monthId);
  const monthRepository = repositories.forMonth(monthId);

  await runTransaction(firestore, async (transaction) => {
    const monthSnapshot = await transaction.get(monthRepository.month);
    if (monthSnapshot.exists()) {
      return;
    }

    transaction.set(monthRepository.month, {
      year: range.year,
      month: range.month,
      month_start: Timestamp.fromDate(range.start),
      month_end: Timestamp.fromDate(range.end),
      is_settled: false,
      calculation_version: 0,
      created_at: serverTimestamp(),
      created_by: actorUid,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
  });

  const employeesQuery = query(repositories.employees, orderBy('teta_number'));
  const [monthSnapshot, employeesSnapshot, dailyValuesSnapshot] =
    await Promise.all([
      getDoc(monthRepository.month),
      getDocs(employeesQuery),
      getDocs(monthRepository.dailyValues),
    ]);

  if (!monthSnapshot.exists()) {
    throw new SettlementServiceError('month-unavailable');
  }

  return {
    month: mapMonthDocument(monthId, monthSnapshot.data()),
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    dailyValues: dailyValuesSnapshot.docs.map((document) =>
      mapDailyValueDocument(document.id, monthId, document.data()),
    ),
  };
}
