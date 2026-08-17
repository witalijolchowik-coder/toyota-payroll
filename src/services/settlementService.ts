import {
  Timestamp,
  doc,
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
  ShiftHoursVersion,
  DepartmentShiftCorrection,
} from '../types/firestore';
import type { HousingDepositWithholdingEvidence } from '../utils/payroll';
import { resolveCompanyAccommodationEpisodes } from '../utils/payroll';
import { latestEmploymentEnd } from '../utils/employees';
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
  mapShiftHoursVersionDocument,
  mapDepartmentShiftCorrectionDocument,
  mapEmployeeContractDocument,
  mapEmploymentEndEventDocument,
} from './firestore/mappers';
import { employeeSettlementConverter } from './firestore/converters';
import { firestorePaths } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import { hydrateEmployeesWithEmploymentHistory } from './employeeHistoryHydration';

export type SettlementServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'month-unavailable'
  | 'contract-history-unavailable';

export type SettlementLoadingStage =
  'month' | 'employees' | 'contracts' | 'settlement';

interface LoadSettlementMonthOptions {
  onLoadingStage?: (stage: SettlementLoadingStage) => void;
}

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
  depositWithholdingEvidenceByEpisodeId: Map<
    string,
    HousingDepositWithholdingEvidence
  >;
  shiftHoursVersions: ShiftHoursVersion[];
  departmentShiftCorrections: DepartmentShiftCorrection[];
  sourceFailures: string[];
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
  source: string,
  failures: string[],
): Promise<T> {
  try {
    return await loader();
  } catch {
    failures.push(source);
    return fallback;
  }
}

export async function loadSettlementMonth(
  monthId: MonthId,
  options: LoadSettlementMonthOptions = {},
): Promise<SettlementMonthData | null> {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new SettlementServiceError('firebase-unavailable');
  }

  await requireActorUid();
  options.onLoadingStage?.('month');
  const monthRepository = repositories.forMonth(monthId);
  const monthSnapshot = await getDoc(monthRepository.month);

  if (!monthSnapshot.exists()) {
    return null;
  }

  options.onLoadingStage?.('employees');
  const employeesQuery = query(repositories.employees, orderBy('teta_number'));
  const employeesSnapshot = await getDocs(employeesQuery);
  const employeeDocuments = employeesSnapshot.docs.map((document) =>
    mapEmployeeDocument(document.id, document.data()),
  );

  options.onLoadingStage?.('contracts');
  let employees: Employee[];
  try {
    const [contractsSnapshot, endEventsSnapshot] = await Promise.all([
      getDocs(repositories.employeeContracts),
      getDocs(repositories.employmentEndEvents),
    ]);
    employees = hydrateEmployeesWithEmploymentHistory(
      employeeDocuments,
      contractsSnapshot.docs.map((document) =>
        mapEmployeeContractDocument(document.id, document.data()),
      ),
      endEventsSnapshot.docs.map((document) =>
        mapEmploymentEndEventDocument(document.id, document.data()),
      ),
    );
  } catch {
    throw new SettlementServiceError('contract-history-unavailable');
  }

  options.onLoadingStage?.('settlement');
  const sourceFailures: string[] = [];

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
    shiftHoursVersions,
    departmentShiftCorrections,
  ] = await Promise.all([
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(repositories.employeeEntitlements);
        return snapshot.docs.map((document) =>
          mapEmployeeEntitlementDocument(document.id, document.data()),
        );
      },
      [] as EmployeeEntitlement[],
      'employeeEntitlements',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(repositories.employeeAssignments);
        return snapshot.docs.map((document) =>
          mapEmployeeAssignmentDocument(document.id, document.data()),
        );
      },
      [] as EmployeeAssignment[],
      'employeeAssignments',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(
          query(repositories.departments, orderBy('name')),
        );
        const mapped = snapshot.docs
          .map((document) =>
            mapDepartmentDocument(document.id, document.data()),
          )
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
      },
      canonicalDepartmentsFallback(),
      'departments',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(monthRepository.dailyValues);
        return snapshot.docs.map((document) =>
          mapDailyValueDocument(document.id, monthId, document.data()),
        );
      },
      [] as DailyValue[],
      'dailyValues',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(monthRepository.scheduleCorrections);
        return snapshot.docs.map((document) =>
          mapScheduleCorrectionDocument(document.id, monthId, document.data()),
        );
      },
      [] as ScheduleCorrection[],
      'scheduleCorrections',
      sourceFailures,
    ),
    optionalSettlementLayer(
      () => loadAbsencesOverlappingMonth(monthId),
      [] as Absence[],
      'absences',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(repositories.payrollSettings);
        return snapshot.docs.map((document) =>
          mapPayrollSettingDocument(document.id, document.data()),
        );
      },
      [] as PayrollSetting[],
      'payrollSettings',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(monthRepository.adjustments);
        return snapshot.docs.map((document) =>
          mapAdjustmentDocument(document.id, monthId, document.data()),
        );
      },
      [] as Adjustment[],
      'adjustments',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(monthRepository.reviewStates);
        return snapshot.docs.map((document) =>
          mapSettlementReviewDocument(document.id, monthId, document.data()),
        );
      },
      [] as SettlementReviewState[],
      'reviewStates',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(repositories.shiftHoursVersions);
        return snapshot.docs.map((document) =>
          mapShiftHoursVersionDocument(document.id, document.data()),
        );
      },
      [] as ShiftHoursVersion[],
      'shiftHoursVersions',
      sourceFailures,
    ),
    optionalSettlementLayer(
      async () => {
        const snapshot = await getDocs(repositories.departmentShiftCorrections);
        return snapshot.docs.map((document) =>
          mapDepartmentShiftCorrectionDocument(document.id, document.data()),
        );
      },
      [] as DepartmentShiftCorrection[],
      'departmentShiftCorrections',
      sourceFailures,
    ),
  ]);

  const depositWithholdingEvidenceByEpisodeId = await optionalSettlementLayer(
    async () => {
      const firestore = getFirestoreClient();
      if (!firestore) throw new Error('firebase-unavailable');
      const evidence = new Map<string, HousingDepositWithholdingEvidence>();
      const episodes = employees.flatMap((employee) => {
        const companyEntitlements = employeeEntitlements.filter(
          (entitlement) => entitlement.employeeId === employee.id,
        );
        const employmentEnd = latestEmploymentEnd(employee)?.endDate ?? null;
        return resolveCompanyAccommodationEpisodes(companyEntitlements)
          .filter(
            (episode) =>
              episode.start.slice(0, 7) < monthId &&
              (episode.end?.slice(0, 7) === monthId ||
                (!episode.end && employmentEnd?.slice(0, 7) === monthId)),
          )
          .map((episode) => ({ episode, employee }));
      });
      await Promise.all(
        episodes.map(async ({ episode, employee }) => {
          const startMonth = episode.start.slice(0, 7) as MonthId;
          const [startMonthSnapshot, settlementSnapshot] = await Promise.all([
            getDoc(repositories.forMonth(startMonth).month),
            getDoc(
              doc(
                firestore,
                firestorePaths.employeeSettlement(startMonth, employee.id),
              ).withConverter(employeeSettlementConverter),
            ),
          ]);
          if (
            !startMonthSnapshot.exists() ||
            !startMonthSnapshot.data().is_settled
          ) {
            return;
          }
          const result = settlementSnapshot.data()?.result;
          const components = result?.components;
          if (!components || typeof components !== 'object') return;
          const values = components as Record<string, unknown>;
          if (
            values.housingDepositEpisodeId === episode.id &&
            typeof values.housingDepositWithholding === 'number' &&
            values.housingDepositWithholding > 0
          ) {
            evidence.set(episode.id, {
              episodeId: episode.id,
              amount: values.housingDepositWithholding,
              monthId: startMonth,
            });
          }
        }),
      );
      return evidence;
    },
    new Map<string, HousingDepositWithholdingEvidence>(),
    'housingDepositHistory',
    sourceFailures,
  );

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
    depositWithholdingEvidenceByEpisodeId,
    shiftHoursVersions,
    departmentShiftCorrections,
    sourceFailures,
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
