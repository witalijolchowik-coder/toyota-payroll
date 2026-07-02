import type {
  Absence,
  AbsenceDocument,
  Adjustment,
  AdjustmentDocument,
  AuditLogDocument,
  AuditLogEntry,
  DailyValue,
  DailyValueDocument,
  Employee,
  EmployeeDocument,
  EmployeeSettlement,
  EmployeeSettlementDocument,
  ImportDocument,
  ImportRecord,
  MonthDocument,
  MonthId,
  PayrollMonth,
  Report,
  ReportDocument,
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
    isActive: document.is_active,
    employmentStartDate: document.employment_start_date?.toDate() ?? null,
    employmentEndDate: document.employment_end_date?.toDate() ?? null,
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
    isSettled: document.is_settled,
    calculationStatus: document.calculation_status ?? null,
    calculationStartedAt: document.calculation_started_at?.toDate() ?? null,
    calculationCompletedAt: document.calculation_completed_at?.toDate() ?? null,
    calculationVersion: document.calculation_version ?? null,
    calculationError: document.calculation_error ?? null,
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
    source: document.source,
    importId: document.import_id,
    note: document.note,
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
    adjustmentCode: document.adjustment_code,
    amount: document.amount,
    unit: document.unit,
    reason: document.reason,
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
