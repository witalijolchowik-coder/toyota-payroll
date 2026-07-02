import type {
  AdjustmentUnit,
  AuditAction,
  EmployeeId,
  ImportType,
  IsoDate,
  TetaNumber,
} from './documents';

export interface EmployeeCreateInput {
  tetaNumber: TetaNumber;
  firstName: string;
  lastName: string;
  isActive: boolean;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
}

export type EmployeeUpdateInput = Partial<EmployeeCreateInput>;

export interface MonthCreateInput {
  year: number;
  month: number;
}

export interface EmployeeReferenceInput {
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
}

export interface DailyValueUpsertInput extends EmployeeReferenceInput {
  date: IsoDate;
  hours: number;
  note: string | null;
}

export interface AbsenceCreateInput extends EmployeeReferenceInput {
  absenceCode: string;
  startDate: IsoDate;
  endDate: IsoDate;
  hoursPerDay: number | null;
  note: string | null;
}

export type AbsenceUpdateInput = Pick<
  AbsenceCreateInput,
  'absenceCode' | 'startDate' | 'endDate' | 'hoursPerDay' | 'note'
>;

export interface AdjustmentUpsertInput extends EmployeeReferenceInput {
  adjustmentCode: string;
  amount: number;
  unit: AdjustmentUnit;
  reason: string;
}

export interface ImportCreateInput {
  importType: ImportType;
  fileName: string;
  storagePath: string;
}

export interface AuditLogCreateInput {
  entityPath: string;
  action: AuditAction;
  changes: Record<string, unknown>;
}

// employeeSettlements, reports, import processing fields, calculation fields,
// and settlement fields intentionally have no client-write input type.
