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
  CalendarAppearanceDocument,
  DailyValueDocument,
  DepartmentDocument,
  EmployeeAssignmentDocument,
  EmployeeDocument,
  EmployeeContractDocument,
  EmploymentEndEventDocument,
  EmployeeEntitlementDocument,
  EmployeeSettlementDocument,
  ImportDocument,
  MonthDocument,
  PayrollSettingDocument,
  ReportDocument,
  ScheduleCorrectionDocument,
  SettlementReviewDocument,
  ShiftHoursVersionDocument,
  DepartmentShiftCorrectionDocument,
} from '../../types/firestore';
import {
  absenceConverter,
  adjustmentConverter,
  auditLogConverter,
  dailyValueConverter,
  departmentConverter,
  employeeConverter,
  employeeContractConverter,
  employmentEndEventConverter,
  employeeAssignmentConverter,
  employeeEntitlementConverter,
  employeeSettlementConverter,
  importConverter,
  monthConverter,
  payrollSettingConverter,
  reportConverter,
  scheduleCorrectionConverter,
  settlementReviewConverter,
  shiftHoursVersionConverter,
  departmentShiftCorrectionConverter,
  calendarAppearanceConverter,
} from './converters';
import { firestorePaths } from './paths';

export interface MonthRepositoryBoundary {
  readonly month: DocumentReference<MonthDocument>;
  readonly employeeSettlements: Query<EmployeeSettlementDocument>;
  readonly reviewStates: CollectionReference<SettlementReviewDocument>;
  reviewState(employeeId: string): DocumentReference<SettlementReviewDocument>;
  readonly dailyValues: CollectionReference<DailyValueDocument>;
  readonly scheduleCorrections: CollectionReference<ScheduleCorrectionDocument>;
  readonly absences: CollectionReference<AbsenceDocument>;
  readonly adjustments: CollectionReference<AdjustmentDocument>;
  readonly imports: CollectionReference<ImportDocument>;
}

export interface FirestoreRepositoryBoundaries {
  readonly calendarAppearance: DocumentReference<CalendarAppearanceDocument>;
  readonly payrollSettings: CollectionReference<PayrollSettingDocument>;
  readonly departments: CollectionReference<DepartmentDocument>;
  readonly shiftHoursVersions: CollectionReference<ShiftHoursVersionDocument>;
  readonly departmentShiftCorrections: CollectionReference<DepartmentShiftCorrectionDocument>;
  readonly employees: CollectionReference<EmployeeDocument>;
  employee(employeeId: string): DocumentReference<EmployeeDocument>;
  readonly employeeContracts: CollectionReference<EmployeeContractDocument>;
  employeeContract(
    contractId: string,
  ): DocumentReference<EmployeeContractDocument>;
  readonly employmentEndEvents: CollectionReference<EmploymentEndEventDocument>;
  employmentEndEvent(
    eventId: string,
  ): DocumentReference<EmploymentEndEventDocument>;
  readonly employeeAssignments: CollectionReference<EmployeeAssignmentDocument>;
  employeeAssignment(
    assignmentId: string,
  ): DocumentReference<EmployeeAssignmentDocument>;
  readonly employeeEntitlements: CollectionReference<EmployeeEntitlementDocument>;
  employeeEntitlement(
    entitlementId: string,
  ): DocumentReference<EmployeeEntitlementDocument>;
  readonly months: CollectionReference<MonthDocument>;
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
  const calendarAppearance = doc(
    firestore,
    firestorePaths.calendarAppearance,
  ).withConverter(calendarAppearanceConverter);
  const employees = collection(
    firestore,
    firestorePaths.employees,
  ).withConverter(employeeConverter);
  const employeeContracts = collection(
    firestore,
    firestorePaths.employeeContracts,
  ).withConverter(employeeContractConverter);
  const employmentEndEvents = collection(
    firestore,
    firestorePaths.employmentEndEvents,
  ).withConverter(employmentEndEventConverter);
  const departments = collection(
    firestore,
    firestorePaths.departments,
  ).withConverter(departmentConverter);
  const shiftHoursVersions = collection(
    firestore,
    firestorePaths.shiftHoursVersions,
  ).withConverter(shiftHoursVersionConverter);
  const departmentShiftCorrections = collection(
    firestore,
    firestorePaths.departmentShiftCorrections,
  ).withConverter(departmentShiftCorrectionConverter);
  const employeeEntitlements = collection(
    firestore,
    firestorePaths.employeeEntitlements,
  ).withConverter(employeeEntitlementConverter);
  const employeeAssignments = collection(
    firestore,
    firestorePaths.employeeAssignments,
  ).withConverter(employeeAssignmentConverter);
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
    calendarAppearance,
    payrollSettings,
    departments,
    shiftHoursVersions,
    departmentShiftCorrections,
    employees,
    employee(employeeId) {
      return doc(firestore, firestorePaths.employee(employeeId)).withConverter(
        employeeConverter,
      );
    },
    employeeContracts,
    employeeContract(contractId) {
      return doc(
        firestore,
        firestorePaths.employeeContract(contractId),
      ).withConverter(employeeContractConverter);
    },
    employmentEndEvents,
    employmentEndEvent(eventId) {
      return doc(
        firestore,
        firestorePaths.employmentEndEvent(eventId),
      ).withConverter(employmentEndEventConverter);
    },
    employeeAssignments,
    employeeAssignment(assignmentId) {
      return doc(
        firestore,
        firestorePaths.employeeAssignment(assignmentId),
      ).withConverter(employeeAssignmentConverter);
    },
    employeeEntitlements,
    employeeEntitlement(entitlementId) {
      return doc(
        firestore,
        firestorePaths.employeeEntitlement(entitlementId),
      ).withConverter(employeeEntitlementConverter);
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
        scheduleCorrections: collection(
          firestore,
          firestorePaths.scheduleCorrections(monthId),
        ).withConverter(scheduleCorrectionConverter),
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
