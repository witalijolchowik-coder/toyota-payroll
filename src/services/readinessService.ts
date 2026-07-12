import { getDoc, getDocs, orderBy, query } from 'firebase/firestore';

import type {
  EmployeeAssignment,
  EmployeeEntitlement,
  MonthId,
  PayrollSetting,
} from '../types/firestore';
import { assessMonthReadiness } from '../utils/readiness';
import type { MonthReadinessSummary } from '../utils/readiness';
import { canonicalDepartmentsFallback } from './departmentsService';
import {
  mapDepartmentDocument,
  mapEmployeeAssignmentDocument,
  mapEmployeeDocument,
  mapEmployeeEntitlementDocument,
  mapMonthDocument,
  mapPayrollSettingDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

async function optionalReadinessLayer<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export async function loadMonthReadiness(
  monthId: MonthId,
): Promise<MonthReadinessSummary> {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new Error('firebase-unavailable');
  }
  const [monthSnapshot, employeesSnapshot] = await Promise.all([
    getDoc(repositories.forMonth(monthId).month),
    getDocs(query(repositories.employees, orderBy('teta_number'))),
  ]);
  const [departments, employeeAssignments, entitlements, payrollSettings] =
    await Promise.all([
      optionalReadinessLayer(async () => {
        const snapshot = await getDocs(repositories.departments);
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
      optionalReadinessLayer(async () => {
        const snapshot = await getDocs(repositories.employeeAssignments);
        return snapshot.docs.map((document) =>
          mapEmployeeAssignmentDocument(document.id, document.data()),
        );
      }, [] as EmployeeAssignment[]),
      optionalReadinessLayer(async () => {
        const snapshot = await getDocs(repositories.employeeEntitlements);
        return snapshot.docs.map((document) =>
          mapEmployeeEntitlementDocument(document.id, document.data()),
        );
      }, [] as EmployeeEntitlement[]),
      optionalReadinessLayer(async () => {
        const snapshot = await getDocs(repositories.payrollSettings);
        return snapshot.docs.map((document) =>
          mapPayrollSettingDocument(document.id, document.data()),
        );
      }, [] as PayrollSetting[]),
    ]);

  return assessMonthReadiness({
    monthId,
    month: monthSnapshot.exists()
      ? mapMonthDocument(monthId, monthSnapshot.data())
      : null,
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    departments,
    employeeAssignments,
    entitlements,
    payrollSettings,
  });
}
