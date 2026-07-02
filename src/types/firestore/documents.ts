import type { Timestamp } from 'firebase/firestore';

export type TetaNumber = string;
export type EmployeeId = string;
export type MonthId = string;
export type IsoDate = string;

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
  employment_start_date: Timestamp | null;
  employment_end_date: Timestamp | null;
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

export interface DailyValueDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  date: IsoDate;
  hours: number;
  source: DailyValueSource;
  import_id: string | null;
  note: string | null;
}

export type AbsenceSource = 'manual' | 'absence_import';

export interface AbsenceDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  absence_code: string;
  start_date: IsoDate;
  end_date: IsoDate;
  hours_per_day: number | null;
  source: AbsenceSource;
  import_id: string | null;
  note: string | null;
}

export type AdjustmentUnit = 'hours' | 'currency' | 'count';

export interface AdjustmentDocument
  extends EmployeeReferenceDocument, ModificationMetadataDocument {
  adjustment_code: string;
  amount: number;
  unit: AdjustmentUnit;
  reason: string;
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
