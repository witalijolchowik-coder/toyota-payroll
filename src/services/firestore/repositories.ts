import {
  collection,
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
  EmployeeDocument,
  EmployeeSettlementDocument,
  ImportDocument,
  MonthDocument,
  ReportDocument,
} from '../../types/firestore';
import {
  absenceConverter,
  adjustmentConverter,
  auditLogConverter,
  dailyValueConverter,
  employeeConverter,
  employeeSettlementConverter,
  importConverter,
  monthConverter,
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
  readonly employees: CollectionReference<EmployeeDocument>;
  employee(employeeId: string): DocumentReference<EmployeeDocument>;
  readonly months: CollectionReference<MonthDocument>;
  forMonth(monthId: string): MonthRepositoryBoundary;
  readonly reports: Query<ReportDocument>;
  readonly auditLog: CollectionReference<AuditLogDocument>;
}

export function createFirestoreRepositoryBoundaries(
  firestore: Firestore,
): FirestoreRepositoryBoundaries {
  const employees = collection(
    firestore,
    firestorePaths.employees,
  ).withConverter(employeeConverter);
  const months = collection(firestore, firestorePaths.months).withConverter(
    monthConverter,
  );
  const reports = collection(firestore, firestorePaths.reports).withConverter(
    reportConverter,
  );
  const auditLog = collection(firestore, firestorePaths.auditLog).withConverter(
    auditLogConverter,
  );

  return {
    employees,
    employee(employeeId) {
      return doc(firestore, firestorePaths.employee(employeeId)).withConverter(
        employeeConverter,
      );
    },
    months,
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
