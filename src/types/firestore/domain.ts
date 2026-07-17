import type {
  AdjustmentCategory,
  AdjustmentDirection,
  AdjustmentStatus,
  AbsenceSource,
  AbsenceStatus,
  AuditAction,
  CalculationStatus,
  DailyValueSource,
  DepartmentId,
  DepartmentShiftMode,
  EmployeeId,
  EmployeeAssignmentStatus,
  EmployeeColorShift,
  EmployeeEntitlementStatus,
  EmployeeEntitlementType,
  EmployeeCitizenship,
  EmployeeGender,
  MedicalExaminationType,
  ActualWorkingShift,
  ImportStatus,
  ImportType,
  IsoDate,
  MonthId,
  PayrollSettingKey,
  ReportStatus,
  ScheduleCorrectionKind,
  ScheduleCorrectionStatus,
  ShiftConfigurationStatus,
  SettlementReviewStatus,
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
  pesel: string | null;
  passportNumber: string | null;
  foreignDocumentNumber: string | null;
  phoneNumber?: string | null;
  citizenship?: EmployeeCitizenship | null;
  gender?: EmployeeGender | null;
  firstToyotaEmploymentDate?: Date | null;
  medicalExaminationDate?: Date | null;
  medicalValidUntil?: Date | null;
  medicalExaminationType?: MedicalExaminationType | null;
  isActive: boolean;
  departmentId: DepartmentId | null;
  shiftAssignment: EmployeeColorShift | null;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
}

export interface Department extends ModificationMetadata {
  id: DepartmentId;
  name: string;
  shiftMode: DepartmentShiftMode;
  active: boolean;
  rotationAnchorWeekStart?: IsoDate | null;
  rotationBaseAssignment?: Partial<
    Record<EmployeeColorShift, ActualWorkingShift>
  > | null;
}

export interface ShiftInterval {
  startTime: string;
  endTime: string;
}

export interface ShiftHoursVersion extends ModificationMetadata {
  id: string;
  validFrom: IsoDate;
  intervals: Record<ActualWorkingShift, ShiftInterval>;
  active: boolean;
  note: string | null;
}

export interface DepartmentShiftCorrection extends ModificationMetadata {
  id: string;
  departmentId: DepartmentId;
  effectiveDate: IsoDate;
  shiftMode: Exclude<DepartmentShiftMode, 'UNKNOWN'>;
  groupAssignments: Partial<Record<EmployeeColorShift, ActualWorkingShift>>;
  status: ShiftConfigurationStatus;
  note: string | null;
}

export interface EmployeeAssignment extends ModificationMetadata {
  id: string;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  departmentId: DepartmentId | null;
  shiftAssignment: EmployeeColorShift | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  status: EmployeeAssignmentStatus;
  note: string | null;
}

export interface ScheduleCorrection extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  date: IsoDate;
  kind: ScheduleCorrectionKind;
  plannedShift: ActualWorkingShift | null;
  plannedHours: number | null;
  note: string | null;
  status: ScheduleCorrectionStatus;
}

export interface PayrollMonth extends ModificationMetadata {
  id: MonthId;
  year: number;
  month: number;
  monthStart: Date;
  monthEnd: Date;
  isSettled: boolean;
  calculationStatus: CalculationStatus | null;
  calculationStartedAt: Date | null;
  calculationCompletedAt: Date | null;
  calculationVersion: number;
  calculationError: string | null;
  calculationInputHash: string | null;
  calculationRunId: string | null;
  calculationBlockerCount: number;
  calculationWarningCount: number;
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
  calculationVersion: number;
  calculationRunId: string;
  inputHash: string;
  status: 'complete' | 'blocked';
  blockerCount: number;
  warningCount: number;
  result: Record<string, unknown>;
}

export interface SettlementReviewState extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  reviewStatus: SettlementReviewStatus;
  reviewNote: string;
  reviewedAt: Date | null;
  reviewedBy: string | null;
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
  manualOverride: {
    hours: number;
    note: string | null;
    actorUid: string;
    updatedAt: Date;
  } | null;
  workTimeCorrection?: {
    plannedShift: ActualWorkingShift;
    plannedStartTime: string;
    plannedEndTime: string;
    actualStartTime: string;
    actualEndTime: string;
    classificationOverride: {
      privateTimeHours: number | null;
      overtime50Hours: number | null;
      overtime100Hours: number | null;
      coverableNiHours: number | null;
      note: string | null;
      actorUid: string;
      updatedAt: Date;
    } | null;
  } | null;
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
  linkedWorkDate?: IsoDate | null;
  source: AbsenceSource;
  importId: string | null;
  status: AbsenceStatus;
  note: string | null;
}

export interface EmployeeEntitlement extends ModificationMetadata {
  id: string;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  type: EmployeeEntitlementType;
  accommodationVariantKey: string | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  status: EmployeeEntitlementStatus;
  note: string | null;
}

export interface PayrollSetting extends ModificationMetadata {
  id: string;
  settingKey: PayrollSettingKey;
  variantKey: string | null;
  variantName: string | null;
  amount: number;
  validFrom: MonthId;
  validTo: MonthId | null;
  active: boolean;
  description: string;
}

export interface Adjustment extends ModificationMetadata {
  id: string;
  monthId: MonthId;
  employeeId: EmployeeId;
  tetaNumber: TetaNumber;
  category: AdjustmentCategory;
  direction: AdjustmentDirection;
  amount: number;
  note: string;
  status: AdjustmentStatus;
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
