import { getDoc, getDocs, orderBy, query } from 'firebase/firestore';

import type { MonthId } from '../types/firestore';
import { assessMonthReadiness } from '../utils/readiness';
import type { MonthReadinessSummary } from '../utils/readiness';
import { canonicalDepartmentsFallback } from './departmentsService';
import {
  mapDepartmentDocument,
  mapDepartmentShiftCorrectionDocument,
  mapEmployeeAssignmentDocument,
  mapEmployeeDocument,
  mapEmployeeEntitlementDocument,
  mapMonthDocument,
  mapPayrollSettingDocument,
  mapShiftHoursVersionDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { loadAbsencesOverlappingMonth } from './absencesService';

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
  const [
    departments,
    employeeAssignments,
    entitlements,
    payrollSettings,
    absences,
    shiftHoursVersions,
    departmentShiftCorrections,
  ] = await Promise.all([
    (async () => {
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
    })(),
    (async () => {
      const snapshot = await getDocs(repositories.employeeAssignments);
      return snapshot.docs.map((document) =>
        mapEmployeeAssignmentDocument(document.id, document.data()),
      );
    })(),
    (async () => {
      const snapshot = await getDocs(repositories.employeeEntitlements);
      return snapshot.docs.map((document) =>
        mapEmployeeEntitlementDocument(document.id, document.data()),
      );
    })(),
    (async () => {
      const snapshot = await getDocs(repositories.payrollSettings);
      return snapshot.docs.map((document) =>
        mapPayrollSettingDocument(document.id, document.data()),
      );
    })(),
    loadAbsencesOverlappingMonth(monthId),
    (async () => {
      const snapshot = await getDocs(repositories.shiftHoursVersions);
      return snapshot.docs.map((document) =>
        mapShiftHoursVersionDocument(document.id, document.data()),
      );
    })(),
    (async () => {
      const snapshot = await getDocs(repositories.departmentShiftCorrections);
      return snapshot.docs.map((document) =>
        mapDepartmentShiftCorrectionDocument(document.id, document.data()),
      );
    })(),
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
    absences,
    shiftHoursVersions,
    departmentShiftCorrections,
  });
}
