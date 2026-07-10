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
  EmployeeEntitlementDocument,
  EmployeeSettlementDocument,
  ImportDocument,
  MonthDocument,
  PayrollSettingDocument,
  ReportDocument,
  SettlementReviewDocument,
} from '../../types/firestore';
import {
  absenceConverter,
  adjustmentConverter,
  auditLogConverter,
  dailyValueConverter,
  departmentConverter,
  employeeConverter,
  employeeEntitlementConverter,
  employeeSettlementConverter,
  importConverter,
  monthConverter,
  payrollSettingConverter,
  reportConverter,
  settlementReviewConverter,
} from './converters';
import { firestorePaths } from './paths';

export interface MonthRepositoryBoundary {
  readonly month: DocumentReference<MonthDocument>;
  readonly employeeSettlements: Query<EmployeeSettlementDocument>;
  readonly reviewStates: CollectionReference<SettlementReviewDocument>;
  reviewState(employeeId: string): DocumentReference<SettlementReviewDocument>;
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
  readonly employeeEntitlements: CollectionReference<EmployeeEntitlementDocument>;
  employeeEntitlement(
    entitlementId: string,
  ): DocumentReference<EmployeeEntitlementDocument>;
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
  const employeeEntitlements = collection(
    firestore,
    firestorePaths.employeeEntitlements,
  ).withConverter(employeeEntitlementConverter);
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
    employeeEntitlements,
    employeeEntitlement(entitlementId) {
      return doc(
        firestore,
        firestorePaths.employeeEntitlement(entitlementId),
      ).withConverter(employeeEntitlementConverter);
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
        reviewStates: collection(
          firestore,
          firestorePaths.reviewStates(monthId),
        ).withConverter(settlementReviewConverter),
        reviewState(employeeId) {
          return doc(
            firestore,
            firestorePaths.reviewState(monthId, employeeId),
          ).withConverter(settlementReviewConverter);
        },
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
