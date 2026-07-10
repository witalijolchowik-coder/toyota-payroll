import type { Timestamp } from 'firebase/firestore';

export type TetaNumber = string;
export type EmployeeId = string;
export type DepartmentId = string;
export type MonthId = string;
export type IsoDate = string;

export type EmployeeColorShift = 'RED' | 'WHITE' | 'BLUE';
export type ActualWorkingShift = 'FIRST' | 'SECOND' | 'NIGHT';
export type DepartmentShiftMode = 'UNKNOWN' | 'TWO_SHIFT' | 'THREE_SHIFT';

export interface EmployeeReferenceDocument {
  employee_id: EmployeeId;
  teta_number: TetaNumber;
}

export interface ModificationMetadataDocument {
  created_at: Timestamp;
  created_by: string;
  updated_at: Timestamp;
  updated_by: string;
}

export interface EmployeeDocument extends ModificationMetadataDocument {
  teta_number: TetaNumber;
  first_name: string;
  last_name: string;
  is_active: boolean;
  department_id?: DepartmentId | null;
  shift_assignment?: EmployeeColorShift | null;
  employment_start_date: Timestamp | null;
  employment_end_date: Timestamp | null;
}

export interface DepartmentDocument extends ModificationMetadataDocument {
  name: string;
  shift_mode: DepartmentShiftMode;
  active: boolean;
}

export type CalculationStatus =
  'not_started' | 'queued' | 'running' | 'completed' | 'failed';

export interface MonthDocument extends ModificationMetadataDocument {
  year: number;
  month: number;
  month_start: Timestamp;
  month_end: Timestamp;
  is_settled: boolean;
  calculation_status?: CalculationStatus;
  calculation_started_at?: Timestamp | null;
  calculation_completed_at?: Timestamp | null;
  calculation_version: number;
  calculation_error?: string | null;
  settled_at?: Timestamp | null;
  settled_by?: string | null;
}

export interface SettlementTotalsDocument {
  worked_hours: number;
  absence_hours: number;
  adjustment_hours: number;
  payable_hours: number;
}

export interface EmployeeSettlementDocument extends EmployeeReferenceDocument {
  totals: SettlementTotalsDocument;
  warnings: string[];
  calculated_at: Timestamp;
  calculation_version: string;
}

export type DailyValueSource = 'manual' | 'attendance_import';

export interface WorkTimeClassificationOverrideDocument {
  private_time_hours: number | null;
  overtime_50_hours: number | null;
  overtime_100_hours: number | null;
  coverable_ni_hours: number | null;
  note: string | null;
  actor_uid: string;
  updated_at: Timestamp;
}

export interface WorkTimeCorrectionDocument {
  planned_shift: ActualWorkingShift;
  planned_start_time: string;
  planned_end_time: string;
  actual_start_time: string;
  actual_end_time: string;
  classification_override?: WorkTimeClassificationOverrideDocument | null;
}

export interface DailyValueManualOverrideDocument {
  hours: number;
  note: string | null;
  actor_uid: string;
  updated_at: Timestamp;
}

export interface DailyValueDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  date: IsoDate;
  hours: number;
  source: DailyValueSource;
  import_id: string | null;
  note: string | null;
  manual_override?: DailyValueManualOverrideDocument | null;
  work_time_correction?: WorkTimeCorrectionDocument | null;
}

export type AbsenceSource = 'manual' | 'absence_import';
export type AbsenceStatus = 'ACTIVE' | 'CANCELLED';

export interface AbsenceDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  absence_code: string;
  start_date: IsoDate;
  end_date: IsoDate;
  hours_per_day: number | null;
  source: AbsenceSource;
  import_id: string | null;
  status: AbsenceStatus;
  note: string | null;
}

export const EMPLOYEE_ENTITLEMENT_TYPES = [
  'UDT',
  'OWN_HOUSING_ALLOWANCE',
  'COMPANY_ACCOMMODATION',
] as const;

export type EmployeeEntitlementType =
  (typeof EMPLOYEE_ENTITLEMENT_TYPES)[number];
export type EmployeeEntitlementStatus = 'ACTIVE' | 'CANCELLED';

export interface EmployeeEntitlementDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  type: EmployeeEntitlementType;
  accommodation_variant_key: string | null;
  valid_from: IsoDate;
  valid_to: IsoDate | null;
  status: EmployeeEntitlementStatus;
  note: string | null;
}

export const PAYROLL_SETTING_KEYS = [
  'frequency_bonus',
  'transport_allowance',
  'accommodation_allowance',
  'udt_allowance',
  'holiday_work_bonus',
  'laundry_allowance',
  'own_housing_allowance',
  'company_housing_media',
] as const;

export type KnownPayrollSettingKey = (typeof PAYROLL_SETTING_KEYS)[number];
export type PayrollSettingKey = KnownPayrollSettingKey | (string & {});

export interface PayrollSettingDocument extends ModificationMetadataDocument {
  setting_key: PayrollSettingKey;
  variant_key: string | null;
  variant_name: string | null;
  amount: number;
  valid_from: MonthId;
  valid_to: MonthId | null;
  active: boolean;
  description: string;
}

export const ADJUSTMENT_CATEGORIES = [
  'MANUAL_BONUS',
  'MANUAL_DEDUCTION',
  'OTHER',
] as const;

export const ADJUSTMENT_DIRECTIONS = ['INCREASE', 'DECREASE'] as const;

export type AdjustmentCategory = (typeof ADJUSTMENT_CATEGORIES)[number];
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number];
export type AdjustmentStatus = 'ACTIVE' | 'CANCELLED';

export interface AdjustmentDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  category: AdjustmentCategory;
  direction: AdjustmentDirection;
  amount: number;
  note: string;
  status: AdjustmentStatus;
}

export type ImportType = 'attendance' | 'absences' | 'l4';
export type ImportStatus = 'pending' | 'processing' | 'applied' | 'failed';

export interface ImportDocument {
  import_type: ImportType;
  file_name: string;
  storage_path: string;
  status: ImportStatus;
  uploaded_at: Timestamp;
  uploaded_by: string;
  processed_at?: Timestamp | null;
  processed_by?: string | null;
  row_count?: number | null;
  error_message?: string | null;
}

export type ReportStatus = 'queued' | 'generating' | 'ready' | 'failed';

export interface ReportDocument {
  month_id: MonthId;
  report_type: string;
  status: ReportStatus;
  requested_at: Timestamp;
  requested_by: string;
  generated_at: Timestamp | null;
  storage_path: string | null;
  error_message: string | null;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'settle';

export interface AuditLogDocument {
  entity_path: string;
  action: AuditAction;
  actor_uid: string;
  occurred_at: Timestamp;
  changes: Record<string, unknown>;
}
