import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
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
  SettlementTotalsDocument,
} from '../../types/firestore';
import {
  readBoolean,
  readEnum,
  readNonEmptyString,
  readNullableNumber,
  readNullableString,
  readNullableTimestamp,
  readNumber,
  readNumberMap,
  readObject,
  readString,
  readOptionalEnum,
  readOptionalNullableNumber,
  readOptionalNullableString,
  readOptionalNullableTimestamp,
  readStringArray,
  readTimestamp,
} from './validation';

function createConverter<T extends DocumentData>(
  parse: (data: DocumentData, path: string) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore(model: WithFieldValue<T>): WithFieldValue<DocumentData> {
      return model;
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions,
    ): T {
      return parse(snapshot.data(options), snapshot.ref.path);
    },
  };
}

function metadata(data: DocumentData, path: string) {
  return {
    created_at: readTimestamp(data, 'created_at', path),
    created_by: readNonEmptyString(data, 'created_by', path),
    updated_at: readTimestamp(data, 'updated_at', path),
    updated_by: readNonEmptyString(data, 'updated_by', path),
  };
}

function employeeReference(data: DocumentData, path: string) {
  return {
    employee_id: readNonEmptyString(data, 'employee_id', path),
    teta_number: readNonEmptyString(data, 'teta_number', path),
  };
}

export const employeeConverter = createConverter<EmployeeDocument>(
  (data, path) => ({
    teta_number: readNonEmptyString(data, 'teta_number', path),
    first_name: readNonEmptyString(data, 'first_name', path),
    last_name: readNonEmptyString(data, 'last_name', path),
    is_active: readBoolean(data, 'is_active', path),
    department_id:
      readOptionalNullableString(data, 'department_id', path) ?? null,
    shift_assignment:
      data.shift_assignment === undefined || data.shift_assignment === null
        ? null
        : readEnum(data, 'shift_assignment', path, [
            'RED',
            'WHITE',
            'BLUE',
          ] as const),
    employment_start_date: readNullableTimestamp(
      data,
      'employment_start_date',
      path,
    ),
    employment_end_date: readNullableTimestamp(
      data,
      'employment_end_date',
      path,
    ),
    ...metadata(data, path),
  }),
);

export const departmentConverter = createConverter<DepartmentDocument>(
  (data, path) => ({
    name: readNonEmptyString(data, 'name', path),
    shift_mode: readEnum(data, 'shift_mode', path, [
      'UNKNOWN',
      'TWO_SHIFT',
      'THREE_SHIFT',
    ] as const),
    active: readBoolean(data, 'active', path),
    ...metadata(data, path),
  }),
);

export const monthConverter = createConverter<MonthDocument>((data, path) => ({
  year: readNumber(data, 'year', path),
  month: readNumber(data, 'month', path),
  month_start: readTimestamp(data, 'month_start', path),
  month_end: readTimestamp(data, 'month_end', path),
  is_settled: readBoolean(data, 'is_settled', path),
  calculation_status: readOptionalEnum(data, 'calculation_status', path, [
    'not_started',
    'queued',
    'running',
    'completed',
    'failed',
  ] as const),
  calculation_started_at: readOptionalNullableTimestamp(
    data,
    'calculation_started_at',
    path,
  ),
  calculation_completed_at: readOptionalNullableTimestamp(
    data,
    'calculation_completed_at',
    path,
  ),
  calculation_version: readNumber(data, 'calculation_version', path),
  calculation_error: readOptionalNullableString(
    data,
    'calculation_error',
    path,
  ),
  settled_at: readOptionalNullableTimestamp(data, 'settled_at', path),
  settled_by: readOptionalNullableString(data, 'settled_by', path),
  ...metadata(data, path),
}));

export const employeeSettlementConverter =
  createConverter<EmployeeSettlementDocument>((data, path) => {
    const totals = readNumberMap(data, 'totals', path);
    const requiredTotals = [
      'worked_hours',
      'absence_hours',
      'adjustment_hours',
      'payable_hours',
    ] as const;

    if (!requiredTotals.every((key) => key in totals)) {
      throw new Error(
        `Invalid Firestore document at "${path}": settlement totals are incomplete.`,
      );
    }

    return {
      ...employeeReference(data, path),
      totals: totals as unknown as SettlementTotalsDocument,
      warnings: readStringArray(data, 'warnings', path),
      calculated_at: readTimestamp(data, 'calculated_at', path),
      calculation_version: readNonEmptyString(
        data,
        'calculation_version',
        path,
      ),
    };
  });

export const dailyValueConverter = createConverter<DailyValueDocument>(
  (data, path) => {
    const rawOverride: unknown = data.manual_override;
    const manualOverride =
      rawOverride === undefined || rawOverride === null
        ? null
        : readObject(data, 'manual_override', path);

    return {
      ...employeeReference(data, path),
      date: readNonEmptyString(data, 'date', path),
      hours: readNumber(data, 'hours', path),
      source: readEnum(data, 'source', path, [
        'manual',
        'attendance_import',
      ] as const),
      import_id: readNullableString(data, 'import_id', path),
      note: readNullableString(data, 'note', path),
      manual_override: manualOverride
        ? {
            hours: readNumber(
              manualOverride,
              'hours',
              `${path}.manual_override`,
            ),
            note: readNullableString(
              manualOverride,
              'note',
              `${path}.manual_override`,
            ),
            actor_uid: readNonEmptyString(
              manualOverride,
              'actor_uid',
              `${path}.manual_override`,
            ),
            updated_at: readTimestamp(
              manualOverride,
              'updated_at',
              `${path}.manual_override`,
            ),
          }
        : null,
      ...metadata(data, path),
    };
  },
);

export const absenceConverter = createConverter<AbsenceDocument>(
  (data, path) => ({
    ...employeeReference(data, path),
    absence_code: readNonEmptyString(data, 'absence_code', path),
    start_date: readNonEmptyString(data, 'start_date', path),
    end_date: readNonEmptyString(data, 'end_date', path),
    hours_per_day: readNullableNumber(data, 'hours_per_day', path),
    source: readEnum(data, 'source', path, [
      'manual',
      'absence_import',
    ] as const),
    import_id: readNullableString(data, 'import_id', path),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    note: readNullableString(data, 'note', path),
    ...metadata(data, path),
  }),
);

export const payrollSettingConverter = createConverter<PayrollSettingDocument>(
  (data, path) => ({
    setting_key: readNonEmptyString(data, 'setting_key', path),
    variant_key: readNullableString(data, 'variant_key', path),
    variant_name: readNullableString(data, 'variant_name', path),
    amount: readNumber(data, 'amount', path),
    valid_from: readNonEmptyString(data, 'valid_from', path),
    valid_to: readNullableString(data, 'valid_to', path),
    active: readBoolean(data, 'active', path),
    description: readString(data, 'description', path),
    ...metadata(data, path),
  }),
);

export const adjustmentConverter = createConverter<AdjustmentDocument>(
  (data, path) => ({
    ...employeeReference(data, path),
    category: readEnum(data, 'category', path, [
      'MANUAL_BONUS',
      'MANUAL_DEDUCTION',
      'OTHER',
    ] as const),
    direction: readEnum(data, 'direction', path, [
      'INCREASE',
      'DECREASE',
    ] as const),
    amount: readNumber(data, 'amount', path),
    note: readString(data, 'note', path),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    ...metadata(data, path),
  }),
);

export const importConverter = createConverter<ImportDocument>(
  (data, path) => ({
    import_type: readEnum(data, 'import_type', path, [
      'attendance',
      'absences',
      'l4',
    ] as const),
    file_name: readNonEmptyString(data, 'file_name', path),
    storage_path: readNonEmptyString(data, 'storage_path', path),
    status: readEnum(data, 'status', path, [
      'pending',
      'processing',
      'applied',
      'failed',
    ] as const),
    uploaded_at: readTimestamp(data, 'uploaded_at', path),
    uploaded_by: readNonEmptyString(data, 'uploaded_by', path),
    processed_at: readOptionalNullableTimestamp(data, 'processed_at', path),
    processed_by: readOptionalNullableString(data, 'processed_by', path),
    row_count: readOptionalNullableNumber(data, 'row_count', path),
    error_message: readOptionalNullableString(data, 'error_message', path),
  }),
);

export const reportConverter = createConverter<ReportDocument>(
  (data, path) => ({
    month_id: readNonEmptyString(data, 'month_id', path),
    report_type: readNonEmptyString(data, 'report_type', path),
    status: readEnum(data, 'status', path, [
      'queued',
      'generating',
      'ready',
      'failed',
    ] as const),
    requested_at: readTimestamp(data, 'requested_at', path),
    requested_by: readNonEmptyString(data, 'requested_by', path),
    generated_at: readNullableTimestamp(data, 'generated_at', path),
    storage_path: readNullableString(data, 'storage_path', path),
    error_message: readNullableString(data, 'error_message', path),
  }),
);

export const auditLogConverter = createConverter<AuditLogDocument>(
  (data, path) => ({
    entity_path: readNonEmptyString(data, 'entity_path', path),
    action: readEnum(data, 'action', path, [
      'create',
      'update',
      'delete',
      'settle',
    ] as const),
    actor_uid: readNonEmptyString(data, 'actor_uid', path),
    occurred_at: readTimestamp(data, 'occurred_at', path),
    changes: readObject(data, 'changes', path),
  }),
);
