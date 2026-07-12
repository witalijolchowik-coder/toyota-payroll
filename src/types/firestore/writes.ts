import type {
  AdjustmentCategory,
  AdjustmentDirection,
  AuditAction,
  ActualWorkingShift,
  DepartmentId,
  DepartmentShiftMode,
  EmployeeId,
  EmployeeColorShift,
  ScheduleCorrectionKind,
  EmployeeEntitlementType,
  ImportType,
  IsoDate,
  MonthId,
  PayrollSettingKey,
  SettlementReviewStatus,
  TetaNumber,
} from './documents';

export interface EmployeeCreateInput {
  tetaNumber: TetaNumber;
  firstName: string;
  lastName: string;
  pesel: string | null;
  passportNumber: string | null;
  foreignDocumentNumber: string | null;
  isActive: boolean;
  departmentId: DepartmentId | null;
  shiftAssignment: EmployeeColorShift | null;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
  assignmentEffectiveDate?: IsoDate | null;
}

export type EmployeeUpdateInput = Partial<EmployeeCreateInput>;

export interface MonthCreateInput {
  year: number;
  month: number;
}

export interface DepartmentCreateInput {
  id: DepartmentId;
  name: string;
  shiftMode: DepartmentShiftMode;
  active: boolean;
}

export type DepartmentUpdateInput = Pick<
  DepartmentCreateInput,
  'name' | 'shiftMode' | 'active'
>;

export interface EmployeeReferenceInput {
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
}

export interface EmployeeAssignmentCreateInput extends EmployeeReferenceInput {
  departmentId: DepartmentId | null;
  shiftAssignment: EmployeeColorShift | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  note: string | null;
}

export interface ScheduleCorrectionCreateInput extends EmployeeReferenceInput {
  date: IsoDate;
  kind: ScheduleCorrectionKind;
  plannedShift: ActualWorkingShift | null;
  plannedHours: number | null;
  note: string | null;
}

export interface DailyValueUpsertInput extends EmployeeReferenceInput {
  date: IsoDate;
  hours: number;
  note: string | null;
  workTimeCorrection?: WorkTimeCorrectionInput | null;
}

export interface WorkTimeClassificationOverrideInput {
  privateTimeHours: number | null;
  overtime50Hours: number | null;
  overtime100Hours: number | null;
  coverableNiHours: number | null;
  note: string | null;
}

export interface WorkTimeCorrectionInput {
  plannedShift: ActualWorkingShift;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime: string;
  actualEndTime: string;
  classificationOverride?: WorkTimeClassificationOverrideInput | null;
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

export interface EmployeeEntitlementCreateInput extends EmployeeReferenceInput {
  type: EmployeeEntitlementType;
  accommodationVariantKey: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  note: string | null;
}

export type EmployeeEntitlementUpdateInput = Pick<
  EmployeeEntitlementCreateInput,
  'validTo' | 'note'
>;

export interface SettlementReviewUpdateInput extends EmployeeReferenceInput {
  reviewStatus: SettlementReviewStatus;
  reviewNote: string;
}

export interface PayrollSettingCreateInput {
  settingKey: PayrollSettingKey;
  variantKey: string | null;
  variantName: string | null;
  amount: number;
  validFrom: MonthId;
  validTo: MonthId | null;
  description: string;
}

export interface AdjustmentCreateInput extends EmployeeReferenceInput {
  category: AdjustmentCategory;
  direction: AdjustmentDirection;
  amount: number;
  note: string;
}

export type AdjustmentUpdateInput = Pick<
  AdjustmentCreateInput,
  'category' | 'direction' | 'amount' | 'note'
>;

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
