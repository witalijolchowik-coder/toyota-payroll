import type {
  Absence,
  Adjustment,
  DailyValue,
  Employee,
  IsoDate,
  MonthId,
  PayrollSetting,
} from '../../types/firestore';
import {
  absenceEmploymentIssue,
  absenceRemovesVirtualDefault,
  normalizeAbsenceCode,
  resolveGoverningAbsence,
  type AbsenceRuleRecord,
} from '../absences';
import {
  resolveAttendanceWarnings,
  resolveEffectiveAttendanceValue,
} from '../attendance';
import { calculateFrequencyBonus } from '../bonuses';
import {
  createPayrollMonthCalendar,
  STANDARD_WORKING_DAY_HOURS,
  type PayrollCalendarOptions,
} from './calendar';
import {
  calculateEmployeeNominalHours,
  employeeParticipatesInPayrollMonth,
  isDateWithinEmploymentPeriod,
  type EmploymentPeriod,
} from './employment';
import { getPayrollMonthDateRange } from './month';
import { resolveEffectivePayrollSetting } from './settings';
import { getPayrollVirtualDefaultHours } from './virtualDefaults';

export type PayrollDraftWarningCode =
  | 'employee-not-participating'
  | 'missing-employment-start'
  | 'attendance-absence-conflict'
  | 'explicit-non-working-day'
  | 'attendance-outside-employment'
  | 'absence-outside-employment'
  | 'ambiguous-absence'
  | 'unresolved-frequency-bonus-setting';

export interface PayrollDraftWarning {
  code: PayrollDraftWarningCode;
  date: IsoDate | null;
  message: string;
}

export interface PayrollDraftAbsenceGroup {
  code: string;
  dayCount: number;
  nominalHours: number;
}

export interface PayrollDraftAdjustmentEntry {
  id: string;
  category: Adjustment['category'];
  direction: Adjustment['direction'];
  amount: number;
  note: string;
}

export interface PayrollDraftFrequencyBonus {
  amount: number | null;
  configuredSettingId: string | null;
  configuredAmount: number | null;
  l4RecordCount: number;
  hasNnAbsence: boolean;
  reason: ReturnType<typeof calculateFrequencyBonus>['reason'];
}

export interface EmployeeMonthlyCalculationDraft {
  employeeId: Employee['id'];
  tetaNumber: Employee['tetaNumber'];
  monthId: MonthId;
  employment: {
    employmentStart: Date | null;
    employmentEnd: Date | null;
    participatesInMonth: boolean;
    fullCalendarMonth: boolean;
    individualNominalHours: number;
  };
  attendance: {
    workedHoursTotal: number;
    explicitHours: number;
    manualHours: number;
    importedHours: number;
    importedOverrideHours: number;
    virtualHours: number;
    conflictDays: IsoDate[];
    outsideEmploymentValueDays: IsoDate[];
  };
  absences: {
    groups: PayrollDraftAbsenceGroup[];
    l4Hours: number;
    nnHours: number;
    approvedOrJustifiedHours: number;
  };
  bonuses: {
    frequency: PayrollDraftFrequencyBonus;
  };
  adjustments: {
    increases: number;
    decreases: number;
    entries: PayrollDraftAdjustmentEntry[];
  };
  warnings: PayrollDraftWarning[];
  totals: {
    workedHours: number;
    nominalHours: number;
    frequencyBonusAmount: number | null;
    manualIncreases: number;
    manualDecreases: number;
    preliminaryGrossAdditions: number;
    preliminaryGrossDeductions: number;
  };
}

export interface MonthlyCalculationDraftInput {
  monthId: MonthId;
  employee: Employee;
  dailyValues: readonly DailyValue[];
  absences: readonly Absence[];
  payrollSettings: readonly PayrollSetting[];
  adjustments: readonly Adjustment[];
  calendarOptions?: PayrollCalendarOptions;
}

export interface MonthlyCalculationDraftsInput extends Omit<
  MonthlyCalculationDraftInput,
  'employee'
> {
  employees: readonly Employee[];
}

const APPROVED_ABSENCE_CODES = new Set(['UW', 'UZ', 'OPD', 'KRW', 'WZN']);

function employmentPeriod(employee: Employee): EmploymentPeriod {
  return {
    employmentStart: employee.employmentStartDate,
    employmentEnd: employee.employmentEndDate,
  };
}

function isActiveEmployeeAbsence(
  employee: Employee,
  absence: Absence,
): boolean {
  return absence.employeeId === employee.id && absence.status === 'ACTIVE';
}

function isEmployeeDailyValue(employee: Employee, value: DailyValue): boolean {
  return value.employeeId === employee.id;
}

function isActiveEmployeeAdjustment(
  employee: Employee,
  adjustment: Adjustment,
): boolean {
  return (
    adjustment.employeeId === employee.id && adjustment.status === 'ACTIVE'
  );
}

function warning(
  code: PayrollDraftWarningCode,
  date: IsoDate | null = null,
): PayrollDraftWarning {
  return { code, date, message: code };
}

function addAbsenceHours(
  groups: Map<string, PayrollDraftAbsenceGroup>,
  code: string,
  isWorkingDay: boolean,
) {
  const current = groups.get(code) ?? {
    code,
    dayCount: 0,
    nominalHours: 0,
  };
  current.dayCount += 1;
  current.nominalHours += isWorkingDay ? STANDARD_WORKING_DAY_HOURS : 0;
  groups.set(code, current);
}

export function calculateEmployeeMonthlyDraft({
  monthId,
  employee,
  dailyValues,
  absences,
  payrollSettings,
  adjustments,
  calendarOptions = {},
}: MonthlyCalculationDraftInput): EmployeeMonthlyCalculationDraft {
  const range = getPayrollMonthDateRange(monthId);
  const employment = employmentPeriod(employee);
  const participatesInMonth = employeeParticipatesInPayrollMonth(
    employment,
    range,
  );
  const individualNominalHours = calculateEmployeeNominalHours(
    monthId,
    employment,
    calendarOptions,
  );
  const fullCalendarMonth =
    participatesInMonth &&
    individualNominalHours > 0 &&
    employee.employmentStartDate !== null &&
    employee.employmentStartDate <= range.start &&
    (!employee.employmentEndDate || employee.employmentEndDate >= range.end);

  const warnings: PayrollDraftWarning[] = [];
  if (!employee.employmentStartDate) {
    warnings.push(warning('missing-employment-start'));
  }
  if (!participatesInMonth) {
    warnings.push(warning('employee-not-participating'));
  }

  const employeeDailyValues = dailyValues.filter((value) =>
    isEmployeeDailyValue(employee, value),
  );
  const dailyValuesByDate = new Map(
    employeeDailyValues.map((value) => [value.date, value]),
  );
  const activeAbsences = absences.filter((absence) =>
    isActiveEmployeeAbsence(employee, absence),
  );
  activeAbsences.forEach((absence) => {
    if (absenceEmploymentIssue(absence, employment) === 'outside-employment') {
      warnings.push(warning('absence-outside-employment', absence.startDate));
    }
  });

  let explicitHours = 0;
  let manualHours = 0;
  let importedHours = 0;
  let importedOverrideHours = 0;
  let virtualHours = 0;
  const conflictDays: IsoDate[] = [];
  const outsideEmploymentValueDays: IsoDate[] = [];
  const absenceGroups = new Map<string, PayrollDraftAbsenceGroup>();

  if (participatesInMonth) {
    createPayrollMonthCalendar(monthId, calendarOptions).forEach((day) => {
      const isWithinEmployment = isDateWithinEmploymentPeriod(
        day.isoDate,
        employment,
      );
      const persistedValue = dailyValuesByDate.get(day.isoDate);
      const absenceResolution = resolveGoverningAbsence(
        activeAbsences,
        day.isoDate,
      );
      const hasGoverningAbsence = absenceResolution.kind !== 'none';

      if (absenceResolution.kind === 'ambiguous') {
        warnings.push(warning('ambiguous-absence', day.isoDate));
      } else if (absenceResolution.kind === 'governed' && isWithinEmployment) {
        addAbsenceHours(
          absenceGroups,
          normalizeAbsenceCode(absenceResolution.code),
          day.isWorkingDay,
        );
      }

      if (persistedValue) {
        const effective = resolveEffectiveAttendanceValue(persistedValue);
        const attendanceWarnings = resolveAttendanceWarnings({
          hasExplicitValue: true,
          hasActiveAbsence: hasGoverningAbsence,
          isWorkingDay: day.isWorkingDay,
          isWithinEmployment,
        });

        attendanceWarnings.forEach((attendanceWarning) => {
          if (attendanceWarning === 'absence-conflict') {
            conflictDays.push(day.isoDate);
            warnings.push(warning('attendance-absence-conflict', day.isoDate));
          } else if (attendanceWarning === 'non-working-explicit') {
            warnings.push(warning('explicit-non-working-day', day.isoDate));
          } else {
            outsideEmploymentValueDays.push(day.isoDate);
            warnings.push(
              warning('attendance-outside-employment', day.isoDate),
            );
          }
        });

        if (isWithinEmployment) {
          explicitHours += effective.hours;
          if (effective.kind === 'manual') {
            manualHours += effective.hours;
          } else if (effective.kind === 'imported') {
            importedHours += effective.hours;
          } else {
            importedOverrideHours += effective.hours;
          }
        }
        return;
      }

      const virtual = getPayrollVirtualDefaultHours({
        isWorkingDay: day.isWorkingDay,
        isWithinEmployment,
        hasGoverningValue: absenceRemovesVirtualDefault(absenceResolution),
      });
      virtualHours += virtual ?? 0;
    });
  }

  const frequencySetting = resolveEffectivePayrollSetting(
    payrollSettings,
    'frequency_bonus',
    monthId,
  );
  const frequencyRule = calculateFrequencyBonus({
    monthId,
    employment,
    absences: activeAbsences as AbsenceRuleRecord[],
  });
  if (!frequencySetting) {
    warnings.push(warning('unresolved-frequency-bonus-setting'));
  }
  const frequencyAmount = frequencySetting ? frequencyRule.amount : null;

  const activeAdjustments = adjustments.filter((adjustment) =>
    isActiveEmployeeAdjustment(employee, adjustment),
  );
  const adjustmentEntries = activeAdjustments.map((adjustment) => ({
    id: adjustment.id,
    category: adjustment.category,
    direction: adjustment.direction,
    amount: adjustment.amount,
    note: adjustment.note,
  }));
  const manualIncreases = adjustmentEntries
    .filter((entry) => entry.direction === 'INCREASE')
    .reduce((total, entry) => total + entry.amount, 0);
  const manualDecreases = adjustmentEntries
    .filter((entry) => entry.direction === 'DECREASE')
    .reduce((total, entry) => total + entry.amount, 0);
  const groups = [...absenceGroups.values()].sort((first, second) =>
    first.code.localeCompare(second.code, 'pl-PL'),
  );
  const hoursForCodes = (codes: ReadonlySet<string>) =>
    groups
      .filter((group) => codes.has(group.code))
      .reduce((total, group) => total + group.nominalHours, 0);
  const preliminaryGrossAdditions = (frequencyAmount ?? 0) + manualIncreases;

  return {
    employeeId: employee.id,
    tetaNumber: employee.tetaNumber,
    monthId,
    employment: {
      employmentStart: employee.employmentStartDate,
      employmentEnd: employee.employmentEndDate,
      participatesInMonth,
      fullCalendarMonth,
      individualNominalHours,
    },
    attendance: {
      workedHoursTotal: explicitHours + virtualHours,
      explicitHours,
      manualHours,
      importedHours,
      importedOverrideHours,
      virtualHours,
      conflictDays,
      outsideEmploymentValueDays,
    },
    absences: {
      groups,
      l4Hours: hoursForCodes(new Set(['L4'])),
      nnHours: hoursForCodes(new Set(['NN'])),
      approvedOrJustifiedHours: hoursForCodes(APPROVED_ABSENCE_CODES),
    },
    bonuses: {
      frequency: {
        amount: frequencyAmount,
        configuredSettingId: frequencySetting?.id ?? null,
        configuredAmount: frequencySetting?.amount ?? null,
        l4RecordCount: frequencyRule.l4RecordCount,
        hasNnAbsence: frequencyRule.hasNnAbsence,
        reason: frequencyRule.reason,
      },
    },
    adjustments: {
      increases: manualIncreases,
      decreases: manualDecreases,
      entries: adjustmentEntries,
    },
    warnings,
    totals: {
      workedHours: explicitHours + virtualHours,
      nominalHours: individualNominalHours,
      frequencyBonusAmount: frequencyAmount,
      manualIncreases,
      manualDecreases,
      preliminaryGrossAdditions,
      preliminaryGrossDeductions: manualDecreases,
    },
  };
}

export function calculateMonthlyDrafts({
  employees,
  ...input
}: MonthlyCalculationDraftsInput): EmployeeMonthlyCalculationDraft[] {
  return employees.map((employee) =>
    calculateEmployeeMonthlyDraft({ ...input, employee }),
  );
}
