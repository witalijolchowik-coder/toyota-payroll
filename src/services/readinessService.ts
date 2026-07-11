import { getDoc, getDocs, orderBy, query } from 'firebase/firestore';

import type { MonthId } from '../types/firestore';
import { assessMonthReadiness } from '../utils/readiness';
import type { MonthReadinessSummary } from '../utils/readiness';
import {
  mapDepartmentDocument,
  mapEmployeeDocument,
  mapEmployeeEntitlementDocument,
  mapMonthDocument,
  mapPayrollSettingDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export async function loadMonthReadiness(
  monthId: MonthId,
): Promise<MonthReadinessSummary> {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new Error('firebase-unavailable');
  }
  const [
    monthSnapshot,
    employeesSnapshot,
    departmentsSnapshot,
    entitlementsSnapshot,
    settingsSnapshot,
  ] = await Promise.all([
    getDoc(repositories.forMonth(monthId).month),
    getDocs(query(repositories.employees, orderBy('teta_number'))),
    getDocs(repositories.departments),
    getDocs(repositories.employeeEntitlements),
    getDocs(repositories.payrollSettings),
  ]);

  return assessMonthReadiness({
    monthId,
    month: monthSnapshot.exists()
      ? mapMonthDocument(monthId, monthSnapshot.data())
      : null,
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    departments: departmentsSnapshot.docs.map((document) =>
      mapDepartmentDocument(document.id, document.data()),
    ),
    entitlements: entitlementsSnapshot.docs.map((document) =>
      mapEmployeeEntitlementDocument(document.id, document.data()),
    ),
    payrollSettings: settingsSnapshot.docs.map((document) =>
      mapPayrollSettingDocument(document.id, document.data()),
    ),
  });
}
