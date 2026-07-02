import type {
  AbsenceSource,
  AdjustmentUnit,
  AuditAction,
  CalculationStatus,
  DailyValueSource,
  EmployeeId,
  ImportStatus,
  ImportType,
  IsoDate,
  MonthId,
  ReportStatus,
  SettlementTotalsDocument,
  TetaNumber,
} from './documents';

export interface ModificationMetadata {
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface Employee extends ModificationMetadata {
  id: EmployeeId;
  tetaNumber: TetaNumber;
  firstName: string;
  lastName: string;
  isActive: boolean;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
}

export interface PayrollMonth extends ModificationMetadata {
  id: MonthId;
  year: number;
  month: number;
  isSettled: boolean;
  calculationStatus: CalculationStatus | null;
  calculationStartedAt: Date | null;
  calculationCompletedAt: Date | null;
  calculationVersion: string | null;
  calculationError: string | null;
  settledAt: Date | null;
  settledBy: string | null;
}

export interface EmployeeSettlement {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  totals: SettlementTotalsDocument;
  warnings: string[];
  calculatedAt: Date;
  calculationVersion: string;
}

export interface DailyValue extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  date: IsoDate;
  hours: number;
  source: DailyValueSource;
  importId: string | null;
  note: string | null;
}

export interface Absence extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  absenceCode: string;
  startDate: IsoDate;
  endDate: IsoDate;
  hoursPerDay: number | null;
  source: AbsenceSource;
  importId: string | null;
  note: string | null;
}

export interface Adjustment extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  adjustmentCode: string;
  amount: number;
  unit: AdjustmentUnit;
  reason: string;
}

export interface ImportRecord {
  id: string;
  monthId: MonthId;
  importType: ImportType;
  fileName: string;
  storagePath: string;
  status: ImportStatus;
  uploadedAt: Date;
  uploadedBy: string;
  processedAt: Date | null;
  processedBy: string | null;
  rowCount: number | null;
  errorMessage: string | null;
}

export interface Report {
  id: string;
  monthId: MonthId;
  reportType: string;
  status: ReportStatus;
  requestedAt: Date;
  requestedBy: string;
  generatedAt: Date | null;
  storagePath: string | null;
  errorMessage: string | null;
}

export interface AuditLogEntry {
  id: string;
  entityPath: string;
  action: AuditAction;
  actorUid: string;
  occurredAt: Date;
  changes: Record<string, unknown>;
}
