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
  CalendarAppearanceDocument,
  DailyValueDocument,
  DepartmentDocument,
  EmployeeDocument,
  EmployeeAssignmentDocument,
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

function readStringRecord(
  data: DocumentData,
  key: string,
  path: string,
): Record<string, string> {
  const source = readObject(data, key, path);
  return Object.fromEntries(
    Object.keys(source).map((entryKey) => [
      entryKey,
      readString(source, entryKey, path),
    ]),
  );
}

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

export const calendarAppearanceConverter =
  createConverter<CalendarAppearanceDocument>((data, path) => ({
    version: readNumber(data, 'version', path),
    text_colors: readStringRecord(data, 'text_colors', path),
    background_colors: readStringRecord(data, 'background_colors', path),
    ...metadata(data, path),
  }));

function employeeReference(data: DocumentData, path: string) {
  return {
    employee_id: readNonEmptyString(data, 'employee_id', path),
    teta_number: readNonEmptyString(data, 'teta_number', path),
  };
}

function readRotationBaseAssignment(
  data: DocumentData,
  path: string,
): Partial<Record<'RED' | 'WHITE' | 'BLUE', 'FIRST' | 'SECOND' | 'NIGHT'>> {
  const result: Partial<
    Record<'RED' | 'WHITE' | 'BLUE', 'FIRST' | 'SECOND' | 'NIGHT'>
  > = {};

  (['RED', 'WHITE', 'BLUE'] as const).forEach((color) => {
    if (data[color] === undefined || data[color] === null) {
      return;
    }
    result[color] = readEnum(data, color, path, [
      'FIRST',
      'SECOND',
      'NIGHT',
    ] as const);
  });

  return result;
}

function readShiftIntervals(data: DocumentData, path: string) {
  const intervals = readObject(data, 'intervals', path);
  return Object.fromEntries(
    (['FIRST', 'SECOND', 'NIGHT'] as const).map((shift) => {
      const interval = readObject(intervals, shift, path);
      return [
        shift,
        {
          start_time: readNonEmptyString(interval, 'start_time', path),
          end_time: readNonEmptyString(interval, 'end_time', path),
        },
      ];
    }),
  ) as ShiftHoursVersionDocument['intervals'];
}

export const employeeConverter = createConverter<EmployeeDocument>(
  (data, path) => ({
    teta_number: readString(data, 'teta_number', path),
    first_name: readNonEmptyString(data, 'first_name', path),
    last_name: readNonEmptyString(data, 'last_name', path),
    pesel: readOptionalNullableString(data, 'pesel', path) ?? null,
    passport_number:
      readOptionalNullableString(data, 'passport_number', path) ?? null,
    foreign_document_number:
      readOptionalNullableString(data, 'foreign_document_number', path) ?? null,
    phone_number:
      readOptionalNullableString(data, 'phone_number', path) ?? null,
    citizenship:
      data.citizenship === undefined || data.citizenship === null
        ? null
        : readString(data, 'citizenship', path),
    gender:
      data.gender === undefined || data.gender === null
        ? null
        : readEnum(data, 'gender', path, ['K', 'M'] as const),
    first_toyota_employment_date:
      readOptionalNullableTimestamp(
        data,
        'first_toyota_employment_date',
        path,
      ) ?? null,
    medical_examination_date:
      readOptionalNullableTimestamp(data, 'medical_examination_date', path) ??
      null,
    medical_valid_until:
      readOptionalNullableTimestamp(data, 'medical_valid_until', path) ?? null,
    medical_examination_type:
      data.medical_examination_type === undefined ||
      data.medical_examination_type === null
        ? null
        : readEnum(data, 'medical_examination_type', path, [
            'PRODUKCJA',
            'MAGAZYNIER',
            'PRODUKCJA_HL_PU',
          ] as const),
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
    rotation_anchor_week_start:
      readOptionalNullableString(data, 'rotation_anchor_week_start', path) ??
      null,
    rotation_base_assignment:
      data.rotation_base_assignment === undefined ||
      data.rotation_base_assignment === null
        ? null
        : readRotationBaseAssignment(
            readObject(data, 'rotation_base_assignment', path),
            path,
          ),
    ...metadata(data, path),
  }),
);

export const shiftHoursVersionConverter =
  createConverter<ShiftHoursVersionDocument>((data, path) => ({
    valid_from: readNonEmptyString(data, 'valid_from', path),
    intervals: readShiftIntervals(data, path),
    active: readBoolean(data, 'active', path),
    note: readNullableString(data, 'note', path),
    ...metadata(data, path),
  }));

export const departmentShiftCorrectionConverter =
  createConverter<DepartmentShiftCorrectionDocument>((data, path) => ({
    department_id: readNonEmptyString(data, 'department_id', path),
    effective_date: readNonEmptyString(data, 'effective_date', path),
    shift_mode: readEnum(data, 'shift_mode', path, [
      'TWO_SHIFT',
      'THREE_SHIFT',
    ] as const),
    group_assignments: readRotationBaseAssignment(
      readObject(data, 'group_assignments', path),
      path,
    ),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    note: readNullableString(data, 'note', path),
    ...metadata(data, path),
  }));

export const employeeAssignmentConverter =
  createConverter<EmployeeAssignmentDocument>((data, path) => ({
    ...employeeReference(data, path),
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
    valid_from: readNonEmptyString(data, 'valid_from', path),
    valid_to: readNullableString(data, 'valid_to', path),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    note: readNullableString(data, 'note', path),
    ...metadata(data, path),
  }));

export const scheduleCorrectionConverter =
  createConverter<ScheduleCorrectionDocument>((data, path) => ({
    ...employeeReference(data, path),
    date: readNonEmptyString(data, 'date', path),
    kind: readEnum(data, 'kind', path, [
      'FIRST_SHIFT',
      'SECOND_SHIFT',
      'NIGHT_SHIFT',
      'DAY_OFF',
      'PUBLIC_HOLIDAY_WORK',
      'BHP',
    ] as const),
    planned_shift:
      data.planned_shift === undefined || data.planned_shift === null
        ? null
        : readEnum(data, 'planned_shift', path, [
            'FIRST',
            'SECOND',
            'NIGHT',
          ] as const),
    planned_hours: readNullableNumber(data, 'planned_hours', path),
    note: readNullableString(data, 'note', path),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    ...metadata(data, path),
  }));

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
  calculation_input_hash:
    readOptionalNullableString(data, 'calculation_input_hash', path) ?? null,
  calculation_run_id:
    readOptionalNullableString(data, 'calculation_run_id', path) ?? null,
  calculation_blocker_count:
    data.calculation_blocker_count === undefined
      ? 0
      : readNumber(data, 'calculation_blocker_count', path),
  calculation_warning_count:
    data.calculation_warning_count === undefined
      ? 0
      : readNumber(data, 'calculation_warning_count', path),
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
      calculation_version: readNumber(data, 'calculation_version', path),
      calculation_run_id: readNonEmptyString(data, 'calculation_run_id', path),
      input_hash: readNonEmptyString(data, 'input_hash', path),
      status: readEnum(data, 'status', path, ['complete', 'blocked'] as const),
      blocker_count: readNumber(data, 'blocker_count', path),
      warning_count: readNumber(data, 'warning_count', path),
      result: readObject(data, 'result', path),
    };
  });

export const settlementReviewConverter =
  createConverter<SettlementReviewDocument>((data, path) => ({
    ...employeeReference(data, path),
    month_id: readNonEmptyString(data, 'month_id', path),
    review_status: readEnum(data, 'review_status', path, [
      'DRAFT',
      'NEEDS_REVIEW',
      'NEEDS_CORRECTION',
      'CHECKED',
    ] as const),
    review_note: readString(data, 'review_note', path),
    reviewed_at: readNullableTimestamp(data, 'reviewed_at', path),
    reviewed_by: readNullableString(data, 'reviewed_by', path),
    deposit_return_override:
      readOptionalNullableNumber(data, 'deposit_return_override', path) ?? null,
    deposit_return_note:
      readOptionalNullableString(data, 'deposit_return_note', path) ?? '',
    ...metadata(data, path),
  }));

export const dailyValueConverter = createConverter<DailyValueDocument>(
  (data, path) => {
    const rawOverride: unknown = data.manual_override;
    const manualOverride =
      rawOverride === undefined || rawOverride === null
        ? null
        : readObject(data, 'manual_override', path);
    const rawWorkTimeCorrection: unknown = data.work_time_correction;
    const workTimeCorrection =
      rawWorkTimeCorrection === undefined || rawWorkTimeCorrection === null
        ? null
        : readObject(data, 'work_time_correction', path);
    const classificationOverride =
      workTimeCorrection?.classification_override === undefined ||
      workTimeCorrection?.classification_override === null
        ? null
        : readObject(
            workTimeCorrection,
            'classification_override',
            `${path}.work_time_correction`,
          );

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
      work_time_correction: workTimeCorrection
        ? {
            planned_shift: readEnum(
              workTimeCorrection,
              'planned_shift',
              `${path}.work_time_correction`,
              ['FIRST', 'SECOND', 'NIGHT'] as const,
            ),
            planned_start_time: readNonEmptyString(
              workTimeCorrection,
              'planned_start_time',
              `${path}.work_time_correction`,
            ),
            planned_end_time: readNonEmptyString(
              workTimeCorrection,
              'planned_end_time',
              `${path}.work_time_correction`,
            ),
            actual_start_time: readNonEmptyString(
              workTimeCorrection,
              'actual_start_time',
              `${path}.work_time_correction`,
            ),
            actual_end_time: readNonEmptyString(
              workTimeCorrection,
              'actual_end_time',
              `${path}.work_time_correction`,
            ),
            classification_override: classificationOverride
              ? {
                  private_time_hours: readNullableNumber(
                    classificationOverride,
                    'private_time_hours',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  overtime_50_hours: readNullableNumber(
                    classificationOverride,
                    'overtime_50_hours',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  overtime_100_hours: readNullableNumber(
                    classificationOverride,
                    'overtime_100_hours',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  coverable_ni_hours: readNullableNumber(
                    classificationOverride,
                    'coverable_ni_hours',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  note: readNullableString(
                    classificationOverride,
                    'note',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  actor_uid: readNonEmptyString(
                    classificationOverride,
                    'actor_uid',
                    `${path}.work_time_correction.classification_override`,
                  ),
                  updated_at: readTimestamp(
                    classificationOverride,
                    'updated_at',
                    `${path}.work_time_correction.classification_override`,
                  ),
                }
              : null,
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
    linked_work_date:
      data.linked_work_date === undefined
        ? null
        : readNullableString(data, 'linked_work_date', path),
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

export const employeeEntitlementConverter =
  createConverter<EmployeeEntitlementDocument>((data, path) => ({
    ...employeeReference(data, path),
    type: readEnum(data, 'type', path, [
      'UDT',
      'OWN_HOUSING_ALLOWANCE',
      'COMPANY_ACCOMMODATION',
    ] as const),
    accommodation_variant_key: readNullableString(
      data,
      'accommodation_variant_key',
      path,
    ),
    valid_from: readNonEmptyString(data, 'valid_from', path),
    valid_to: readNullableString(data, 'valid_to', path),
    status: readEnum(data, 'status', path, ['ACTIVE', 'CANCELLED'] as const),
    note: readNullableString(data, 'note', path),
    ...metadata(data, path),
  }));

export const payrollSettingConverter = createConverter<PayrollSettingDocument>(
  (data, path) => ({
    setting_key: readNonEmptyString(data, 'setting_key', path),
    variant_key: readNullableString(data, 'variant_key', path),
    variant_name: readNullableString(data, 'variant_name', path),
    amount: readNumber(data, 'amount', path),
    tax_type:
      readOptionalEnum(data, 'tax_type', path, ['GROSS', 'NET'] as const) ??
      (data.setting_key === 'transport_allowance' ||
      data.setting_key === 'housing_deposit'
        ? 'NET'
        : 'GROSS'),
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
