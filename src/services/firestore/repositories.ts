import {
  collection,
  collectionGroup,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
  type Query,
} from 'firebase/firestore';

import type {
  AbsenceDocument,
  AdjustmentDocument,
  AuditLogDocument,
  DailyValueDocument,
  DepartmentDocument,
  EmployeeDocument,
  EmployeeSettlementDocument,
  ImportDocument,
  MonthDocument,
  PayrollSettingDocument,
  ReportDocument,
} from '../../types/firestore';
import {
  absenceConverter,
  adjustmentConverter,
  auditLogConverter,
  dailyValueConverter,
  departmentConverter,
  employeeConverter,
  employeeSettlementConverter,
  importConverter,
  monthConverter,
  payrollSettingConverter,
  reportConverter,
} from './converters';
import { firestorePaths } from './paths';

export interface MonthRepositoryBoundary {
  readonly month: DocumentReference<MonthDocument>;
  readonly employeeSettlements: Query<EmployeeSettlementDocument>;
  readonly dailyValues: CollectionReference<DailyValueDocument>;
  readonly absences: CollectionReference<AbsenceDocument>;
  readonly adjustments: CollectionReference<AdjustmentDocument>;
  readonly imports: CollectionReference<ImportDocument>;
}

export interface FirestoreRepositoryBoundaries {
  readonly payrollSettings: CollectionReference<PayrollSettingDocument>;
  readonly departments: CollectionReference<DepartmentDocument>;
  readonly employees: CollectionReference<EmployeeDocument>;
  employee(employeeId: string): DocumentReference<EmployeeDocument>;
  readonly months: CollectionReference<MonthDocument>;
  readonly allAbsences: Query<AbsenceDocument>;
  forMonth(monthId: string): MonthRepositoryBoundary;
  readonly reports: Query<ReportDocument>;
  readonly auditLog: CollectionReference<AuditLogDocument>;
}

export function createFirestoreRepositoryBoundaries(
  firestore: Firestore,
): FirestoreRepositoryBoundaries {
  const payrollSettings = collection(
    firestore,
    firestorePaths.payrollSettings,
  ).withConverter(payrollSettingConverter);
  const employees = collection(
    firestore,
    firestorePaths.employees,
  ).withConverter(employeeConverter);
  const departments = collection(
    firestore,
    firestorePaths.departments,
  ).withConverter(departmentConverter);
  const months = collection(firestore, firestorePaths.months).withConverter(
    monthConverter,
  );
  const reports = collection(firestore, firestorePaths.reports).withConverter(
    reportConverter,
  );
  const auditLog = collection(firestore, firestorePaths.auditLog).withConverter(
    auditLogConverter,
  );
  const allAbsences = collectionGroup(firestore, 'absences').withConverter(
    absenceConverter,
  );

  return {
    payrollSettings,
    departments,
    employees,
    employee(employeeId) {
      return doc(firestore, firestorePaths.employee(employeeId)).withConverter(
        employeeConverter,
      );
    },
    months,
    allAbsences,
    forMonth(monthId) {
      return {
        month: doc(firestore, firestorePaths.month(monthId)).withConverter(
          monthConverter,
        ),
        employeeSettlements: collection(
          firestore,
          firestorePaths.employeeSettlements(monthId),
        ).withConverter(employeeSettlementConverter),
        dailyValues: collection(
          firestore,
          firestorePaths.dailyValues(monthId),
        ).withConverter(dailyValueConverter),
        absences: collection(
          firestore,
          firestorePaths.absences(monthId),
        ).withConverter(absenceConverter),
        adjustments: collection(
          firestore,
          firestorePaths.adjustments(monthId),
        ).withConverter(adjustmentConverter),
        imports: collection(
          firestore,
          firestorePaths.imports(monthId),
        ).withConverter(importConverter),
      };
    },
    reports,
    auditLog,
  };
}
