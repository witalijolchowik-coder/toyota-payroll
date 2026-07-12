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
  Absence,
  Adjustment,
  DailyValue,
  Department,
  Employee,
  EmployeeAssignment,
  EmployeeEntitlement,
  MonthId,
  PayrollSetting,
  PayrollMonth,
  ScheduleCorrection,
  SettlementReviewState,
} from '../types/firestore';
import { loadAbsencesOverlappingMonth } from './absencesService';
import { canonicalDepartmentsFallback } from './departmentsService';
import {
  mapAdjustmentDocument,
  mapDailyValueDocument,
  mapDepartmentDocument,
  mapEmployeeAssignmentDocument,
  mapEmployeeDocument,
  mapEmployeeEntitlementDocument,
  mapMonthDocument,
  mapPayrollSettingDocument,
  mapScheduleCorrectionDocument,
  mapSettlementReviewDocument,
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
  employeeEntitlements: EmployeeEntitlement[];
  employeeAssignments: EmployeeAssignment[];
  departments: Department[];
  dailyValues: DailyValue[];
  scheduleCorrections: ScheduleCorrection[];
  absences: Absence[];
  payrollSettings: PayrollSetting[];
  adjustments: Adjustment[];
  reviewStates: SettlementReviewState[];
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

async function optionalSettlementLayer<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export async function loadSettlementMonth(
  monthId: MonthId,
): Promise<SettlementMonthData | null> {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new SettlementServiceError('firebase-unavailable');
  }

  await requireActorUid();
  const monthRepository = repositories.forMonth(monthId);
  const monthSnapshot = await getDoc(monthRepository.month);

  if (!monthSnapshot.exists()) {
    return null;
  }

  const employeesQuery = query(repositories.employees, orderBy('teta_number'));
  const employeesSnapshot = await getDocs(employeesQuery);
  const employees = employeesSnapshot.docs.map((document) =>
    mapEmployeeDocument(document.id, document.data()),
  );

  const [
    employeeEntitlements,
    employeeAssignments,
    departments,
    dailyValues,
    scheduleCorrections,
    absences,
    payrollSettings,
    adjustments,
    reviewStates,
  ] = await Promise.all([
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(repositories.employeeEntitlements);
      return snapshot.docs.map((document) =>
        mapEmployeeEntitlementDocument(document.id, document.data()),
      );
    }, [] as EmployeeEntitlement[]),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(repositories.employeeAssignments);
      return snapshot.docs.map((document) =>
        mapEmployeeAssignmentDocument(document.id, document.data()),
      );
    }, [] as EmployeeAssignment[]),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(
        query(repositories.departments, orderBy('name')),
      );
      const mapped = snapshot.docs
        .map((document) => mapDepartmentDocument(document.id, document.data()))
        .filter((department) =>
          canonicalDepartmentsFallback().some(
            (canonical) => canonical.id === department.id,
          ),
        );
      const byId = new Map(
        mapped.map((department) => [department.id, department]),
      );
      return canonicalDepartmentsFallback().map(
        (fallback) => byId.get(fallback.id) ?? fallback,
      );
    }, canonicalDepartmentsFallback()),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(monthRepository.dailyValues);
      return snapshot.docs.map((document) =>
        mapDailyValueDocument(document.id, monthId, document.data()),
      );
    }, [] as DailyValue[]),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(monthRepository.scheduleCorrections);
      return snapshot.docs.map((document) =>
        mapScheduleCorrectionDocument(document.id, monthId, document.data()),
      );
    }, [] as ScheduleCorrection[]),
    optionalSettlementLayer(
      () => loadAbsencesOverlappingMonth(monthId),
      [] as Absence[],
    ),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(repositories.payrollSettings);
      return snapshot.docs.map((document) =>
        mapPayrollSettingDocument(document.id, document.data()),
      );
    }, [] as PayrollSetting[]),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(monthRepository.adjustments);
      return snapshot.docs.map((document) =>
        mapAdjustmentDocument(document.id, monthId, document.data()),
      );
    }, [] as Adjustment[]),
    optionalSettlementLayer(async () => {
      const snapshot = await getDocs(monthRepository.reviewStates);
      return snapshot.docs.map((document) =>
        mapSettlementReviewDocument(document.id, monthId, document.data()),
      );
    }, [] as SettlementReviewState[]),
  ]);

  return {
    month: mapMonthDocument(monthId, monthSnapshot.data()),
    employees,
    employeeEntitlements,
    employeeAssignments,
    departments,
    dailyValues,
    scheduleCorrections,
    absences,
    payrollSettings,
    adjustments,
    reviewStates,
  };
}

export async function createSettlementMonth(monthId: MonthId): Promise<void> {
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
}
