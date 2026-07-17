import type {
  Absence,
  AbsenceDocument,
  Adjustment,
  AdjustmentDocument,
  AuditLogDocument,
  AuditLogEntry,
  DailyValue,
  DailyValueDocument,
  Department,
  DepartmentDocument,
  Employee,
  EmployeeAssignment,
  EmployeeAssignmentDocument,
  EmployeeDocument,
  EmployeeEntitlement,
  EmployeeEntitlementDocument,
  EmployeeSettlement,
  EmployeeSettlementDocument,
  ImportDocument,
  ImportRecord,
  MonthDocument,
  MonthId,
  PayrollSetting,
  PayrollSettingDocument,
  PayrollMonth,
  Report,
  ReportDocument,
  ScheduleCorrection,
  ScheduleCorrectionDocument,
  SettlementReviewDocument,
  SettlementReviewState,
  ShiftHoursVersion,
  ShiftHoursVersionDocument,
  DepartmentShiftCorrection,
  DepartmentShiftCorrectionDocument,
} from '../../types/firestore';

function modificationMetadata(document: {
  created_at: { toDate(): Date };
  created_by: string;
  updated_at: { toDate(): Date };
  updated_by: string;
}) {
  return {
    createdAt: document.created_at.toDate(),
    createdBy: document.created_by,
    updatedAt: document.updated_at.toDate(),
    updatedBy: document.updated_by,
  };
}

export function mapEmployeeDocument(
  id: string,
  document: EmployeeDocument,
): Employee {
  return {
    id,
    tetaNumber: document.teta_number,
    firstName: document.first_name,
    lastName: document.last_name,
    pesel: document.pesel ?? null,
    passportNumber: document.passport_number ?? null,
    foreignDocumentNumber: document.foreign_document_number ?? null,
    phoneNumber: document.phone_number ?? null,
    citizenship: document.citizenship ?? null,
    gender: document.gender ?? null,
    firstToyotaEmploymentDate:
      document.first_toyota_employment_date?.toDate() ?? null,
    medicalExaminationDate: document.medical_examination_date?.toDate() ?? null,
    medicalValidUntil: document.medical_valid_until?.toDate() ?? null,
    medicalExaminationType: document.medical_examination_type ?? null,
    isActive: document.is_active,
    departmentId: document.department_id ?? null,
    shiftAssignment: document.shift_assignment ?? null,
    employmentStartDate: document.employment_start_date?.toDate() ?? null,
    employmentEndDate: document.employment_end_date?.toDate() ?? null,
    ...modificationMetadata(document),
  };
}

export function mapDepartmentDocument(
  id: string,
  document: DepartmentDocument,
): Department {
  return {
    id,
    name: document.name,
    shiftMode: document.shift_mode,
    active: document.active,
    rotationAnchorWeekStart: document.rotation_anchor_week_start ?? null,
    rotationBaseAssignment: document.rotation_base_assignment ?? null,
    ...modificationMetadata(document),
  };
}

export function mapShiftHoursVersionDocument(
  id: string,
  document: ShiftHoursVersionDocument,
): ShiftHoursVersion {
  return {
    id,
    validFrom: document.valid_from,
    intervals: Object.fromEntries(
      Object.entries(document.intervals).map(([shift, interval]) => [
        shift,
        { startTime: interval.start_time, endTime: interval.end_time },
      ]),
    ) as ShiftHoursVersion['intervals'],
    active: document.active,
    note: document.note,
    ...modificationMetadata(document),
  };
}

export function mapDepartmentShiftCorrectionDocument(
  id: string,
  document: DepartmentShiftCorrectionDocument,
): DepartmentShiftCorrection {
  return {
    id,
    departmentId: document.department_id,
    effectiveDate: document.effective_date,
    shiftMode: document.shift_mode,
    groupAssignments: { ...document.group_assignments },
    status: document.status,
    note: document.note,
    ...modificationMetadata(document),
  };
}

export function mapEmployeeAssignmentDocument(
  id: string,
  document: EmployeeAssignmentDocument,
): EmployeeAssignment {
  return {
    id,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    departmentId: document.department_id,
    shiftAssignment: document.shift_assignment,
    validFrom: document.valid_from,
    validTo: document.valid_to,
    status: document.status,
    note: document.note,
    ...modificationMetadata(document),
  };
}

export function mapScheduleCorrectionDocument(
  id: string,
  monthId: MonthId,
  document: ScheduleCorrectionDocument,
): ScheduleCorrection {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    date: document.date,
    kind: document.kind,
    plannedShift: document.planned_shift,
    plannedHours: document.planned_hours,
    note: document.note,
    status: document.status,
    ...modificationMetadata(document),
  };
}

export function mapMonthDocument(
  id: MonthId,
  document: MonthDocument,
): PayrollMonth {
  return {
    id,
    year: document.year,
    month: document.month,
    monthStart: document.month_start.toDate(),
    monthEnd: document.month_end.toDate(),
    isSettled: document.is_settled,
    calculationStatus: document.calculation_status ?? null,
    calculationStartedAt: document.calculation_started_at?.toDate() ?? null,
    calculationCompletedAt: document.calculation_completed_at?.toDate() ?? null,
    calculationVersion: document.calculation_version,
    calculationError: document.calculation_error ?? null,
    calculationInputHash: document.calculation_input_hash ?? null,
    calculationRunId: document.calculation_run_id ?? null,
    calculationBlockerCount: document.calculation_blocker_count ?? 0,
    calculationWarningCount: document.calculation_warning_count ?? 0,
    settledAt: document.settled_at?.toDate() ?? null,
    settledBy: document.settled_by ?? null,
    ...modificationMetadata(document),
  };
}

export function mapEmployeeSettlementDocument(
  id: string,
  monthId: MonthId,
  document: EmployeeSettlementDocument,
): EmployeeSettlement {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    totals: { ...document.totals },
    warnings: [...document.warnings],
    calculatedAt: document.calculated_at.toDate(),
    calculationVersion: document.calculation_version,
    calculationRunId: document.calculation_run_id,
    inputHash: document.input_hash,
    status: document.status,
    blockerCount: document.blocker_count,
    warningCount: document.warning_count,
    result: { ...document.result },
  };
}

export function mapSettlementReviewDocument(
  id: string,
  monthId: MonthId,
  document: SettlementReviewDocument,
): SettlementReviewState {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    reviewStatus: document.review_status,
    reviewNote: document.review_note,
    reviewedAt: document.reviewed_at?.toDate() ?? null,
    reviewedBy: document.reviewed_by,
    ...modificationMetadata(document),
  };
}

export function mapDailyValueDocument(
  id: string,
  monthId: MonthId,
  document: DailyValueDocument,
): DailyValue {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    date: document.date,
    hours: document.hours,
    source: document.source,
    importId: document.import_id,
    note: document.note,
    manualOverride: document.manual_override
      ? {
          hours: document.manual_override.hours,
          note: document.manual_override.note,
          actorUid: document.manual_override.actor_uid,
          updatedAt: document.manual_override.updated_at.toDate(),
        }
      : null,
    workTimeCorrection: document.work_time_correction
      ? {
          plannedShift: document.work_time_correction.planned_shift,
          plannedStartTime: document.work_time_correction.planned_start_time,
          plannedEndTime: document.work_time_correction.planned_end_time,
          actualStartTime: document.work_time_correction.actual_start_time,
          actualEndTime: document.work_time_correction.actual_end_time,
          classificationOverride: document.work_time_correction
            .classification_override
            ? {
                privateTimeHours:
                  document.work_time_correction.classification_override
                    .private_time_hours,
                overtime50Hours:
                  document.work_time_correction.classification_override
                    .overtime_50_hours,
                overtime100Hours:
                  document.work_time_correction.classification_override
                    .overtime_100_hours,
                coverableNiHours:
                  document.work_time_correction.classification_override
                    .coverable_ni_hours,
                note: document.work_time_correction.classification_override
                  .note,
                actorUid:
                  document.work_time_correction.classification_override
                    .actor_uid,
                updatedAt:
                  document.work_time_correction.classification_override.updated_at.toDate(),
              }
            : null,
        }
      : null,
    ...modificationMetadata(document),
  };
}

export function mapAbsenceDocument(
  id: string,
  monthId: MonthId,
  document: AbsenceDocument,
): Absence {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    absenceCode: document.absence_code,
    startDate: document.start_date,
    endDate: document.end_date,
    hoursPerDay: document.hours_per_day,
    linkedWorkDate: document.linked_work_date,
    source: document.source,
    importId: document.import_id,
    status: document.status,
    note: document.note,
    ...modificationMetadata(document),
  };
}

export function mapEmployeeEntitlementDocument(
  id: string,
  document: EmployeeEntitlementDocument,
): EmployeeEntitlement {
  return {
    id,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    type: document.type,
    accommodationVariantKey: document.accommodation_variant_key,
    validFrom: document.valid_from,
    validTo: document.valid_to,
    status: document.status,
    note: document.note,
    ...modificationMetadata(document),
  };
}

export function mapPayrollSettingDocument(
  id: string,
  document: PayrollSettingDocument,
): PayrollSetting {
  return {
    id,
    settingKey: document.setting_key,
    variantKey: document.variant_key,
    variantName: document.variant_name,
    amount: document.amount,
    validFrom: document.valid_from,
    validTo: document.valid_to,
    active: document.active,
    description: document.description,
    ...modificationMetadata(document),
  };
}

export function mapAdjustmentDocument(
  id: string,
  monthId: MonthId,
  document: AdjustmentDocument,
): Adjustment {
  return {
    id,
    monthId,
    employeeId: document.employee_id,
    tetaNumber: document.teta_number,
    category: document.category,
    direction: document.direction,
    amount: document.amount,
    note: document.note,
    status: document.status,
    ...modificationMetadata(document),
  };
}

export function mapImportDocument(
  id: string,
  monthId: MonthId,
  document: ImportDocument,
): ImportRecord {
  return {
    id,
    monthId,
    importType: document.import_type,
    fileName: document.file_name,
    storagePath: document.storage_path,
    status: document.status,
    uploadedAt: document.uploaded_at.toDate(),
    uploadedBy: document.uploaded_by,
    processedAt: document.processed_at?.toDate() ?? null,
    processedBy: document.processed_by ?? null,
    rowCount: document.row_count ?? null,
    errorMessage: document.error_message ?? null,
  };
}

export function mapReportDocument(
  id: string,
  document: ReportDocument,
): Report {
  return {
    id,
    monthId: document.month_id,
    reportType: document.report_type,
    status: document.status,
    requestedAt: document.requested_at.toDate(),
    requestedBy: document.requested_by,
    generatedAt: document.generated_at?.toDate() ?? null,
    storagePath: document.storage_path,
    errorMessage: document.error_message,
  };
}

export function mapAuditLogDocument(
  id: string,
  document: AuditLogDocument,
): AuditLogEntry {
  return {
    id,
    entityPath: document.entity_path,
    action: document.action,
    actorUid: document.actor_uid,
    occurredAt: document.occurred_at.toDate(),
    changes: { ...document.changes },
  };
}
