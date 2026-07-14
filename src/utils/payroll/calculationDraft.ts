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
  isImportedAbsence,
  isL4Absence,
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
import type { EmployeeSettlementEntitlements } from './employeeEntitlements';
import {
  calculateEmployeeNominalHours,
  employeeParticipatesInPayrollMonth,
  isDateWithinEmploymentPeriod,
  type EmploymentPeriod,
} from './employment';
import { dateToIsoDate, getPayrollMonthDateRange } from './month';
import { baseSalaryForFirstToyotaEmploymentDate } from './employeeReadiness';
import { resolveEffectivePayrollSetting } from './settings';
import { getPayrollVirtualDefaultHours } from './virtualDefaults';
import {
  balanceMonthlyWorkTimeDeviations,
  plannedIntervalForShift,
  resolveDailyWorkTimeDeviation,
  type DailyWorkTimeDeviation,
} from './workTimeDeviations';

export type PayrollDraftWarningCode =
  | 'employee-not-participating'
  | 'missing-employment-start'
  | 'missing-first-toyota-employment-date'
  | 'attendance-absence-conflict'
  | 'explicit-non-working-day'
  | 'attendance-outside-employment'
  | 'absence-outside-employment'
  | 'ambiguous-absence'
  | 'unconfirmed-l4'
  | 'unresolved-frequency-bonus-setting'
  | 'unresolved-work-time-classification'
  | 'housing-entitlement-conflict'
  | 'company-accommodation-missing-variant'
  | 'unresolved-company-accommodation-variant'
  | 'unresolved-own-housing-setting';

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

export interface PayrollDraftAbsencePeriod {
  id: string;
  code: string;
  startDate: IsoDate;
  endDate: IsoDate;
  workingDayCount: number;
  workingHours: number;
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
    periods: PayrollDraftAbsencePeriod[];
    l4Hours: number;
    vacationHours: number;
    otherAbsenceHours: number;
    nnHours: number;
    approvedOrJustifiedHours: number;
  };
  workDays: {
    eligibleWorkingDays: number;
    physicallyWorkedDays: number;
  };
  workTime: {
    normalWorkHours: number;
    privateTimeHours: number;
    privateTimeCoveredHours: number;
    uncoveredPrivateTimeHours: number;
    coverableNiHours: number;
    coverableNiCoveredHours: number;
    uncoveredCoverableNiHours: number;
    overtime50Hours: number;
    overtime100Hours: number;
    paidOvertime50Hours: number;
    paidOvertime100Hours: number;
    holidayWorkBonusEligible: boolean;
    unresolvedClassificationDays: IsoDate[];
    niedoczasHours: number;
  };
  bonuses: {
    frequency: PayrollDraftFrequencyBonus;
  };
  adjustments: {
    increases: number;
    decreases: number;
    entries: PayrollDraftAdjustmentEntry[];
  };
  components: {
    baseSalaryBrutto: number | null;
    frequencyBonusBrutto: number | null;
    holidayWorkBonusBrutto: number;
    transportAllowanceNetto: number;
    udtAllowanceBrutto: number;
    laundryAllowanceBrutto: number;
    ownHousingAllowanceBrutto: number;
    manualIncreases: number;
    manualDecreases: number;
    companyAccommodationDeduction: number;
    companyAccommodationMediaDeduction: number;
    companyAccommodationRentDeduction: number;
  };
  warnings: PayrollDraftWarning[];
  totals: {
    workedHours: number;
    nominalHours: number;
    frequencyBonusAmount: number | null;
    manualIncreases: number;
    manualDecreases: number;
    bruttoAdditions: number;
    nettoAllowances: number;
    deductions: number;
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
  entitlements?: EmployeeSettlementEntitlements | null;
  calendarOptions?: PayrollCalendarOptions;
}

export interface MonthlyCalculationDraftsInput extends Omit<
  MonthlyCalculationDraftInput,
  'employee' | 'entitlements'
> {
  employees: readonly Employee[];
  entitlementsByEmployeeId?: ReadonlyMap<
    string,
    EmployeeSettlementEntitlements
  >;
}

const APPROVED_ABSENCE_CODES = new Set(['UW', 'UZ', 'OPD', 'KRW', 'WZN']);
const VACATION_ABSENCE_CODES = new Set(['UW', 'UZ']);
const DEFAULT_TRANSPORT_ALLOWANCE = 275;
const DEFAULT_HOLIDAY_WORK_BONUS = 300;
const DEFAULT_UDT_ALLOWANCE = 300;
const DEFAULT_LAUNDRY_ALLOWANCE = 40;
const DEFAULT_COMPANY_HOUSING_MEDIA = 500;

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

function isPayrollEffectiveAbsence(absence: Absence): boolean {
  return !isL4Absence(absence) || isImportedAbsence(absence);
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

function configuredAmount(
  settings: readonly PayrollSetting[],
  settingKey: string,
  monthId: MonthId,
  defaultAmount: number,
  variantKey: string | null = null,
): number {
  return (
    resolveEffectivePayrollSetting(settings, settingKey, monthId, variantKey)
      ?.amount ?? defaultAmount
  );
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function prorateByWorkedDays({
  monthlyAmount,
  eligibleWorkingDays,
  physicallyWorkedDays,
}: {
  monthlyAmount: number;
  eligibleWorkingDays: number;
  physicallyWorkedDays: number;
}): number {
  if (eligibleWorkingDays <= 0 || physicallyWorkedDays <= 0) {
    return 0;
  }

  return roundMoney(
    (monthlyAmount / eligibleWorkingDays) *
      Math.min(physicallyWorkedDays, eligibleWorkingDays),
  );
}

function isoDateToUtcDate(isoDate: IsoDate): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function overlapIsoRange(
  startDate: IsoDate,
  endDate: IsoDate,
  rangeStart: IsoDate,
  rangeEnd: IsoDate,
) {
  const start = startDate > rangeStart ? startDate : rangeStart;
  const end = endDate < rangeEnd ? endDate : rangeEnd;
  return start <= end ? { start, end } : null;
}

function countCalendarDaysInclusive(startDate: IsoDate, endDate: IsoDate) {
  const start = isoDateToUtcDate(startDate);
  const end = isoDateToUtcDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function countEligibleWorkingDays({
  monthId,
  employment,
  calendarOptions,
}: {
  monthId: MonthId;
  employment: EmploymentPeriod;
  calendarOptions: PayrollCalendarOptions;
}) {
  return createPayrollMonthCalendar(monthId, calendarOptions).filter(
    (day) =>
      day.isWorkingDay && isDateWithinEmploymentPeriod(day.isoDate, employment),
  ).length;
}

function calculateAbsencePeriods({
  monthId,
  employment,
  absences,
  calendarOptions,
}: {
  monthId: MonthId;
  employment: EmploymentPeriod;
  absences: readonly Absence[];
  calendarOptions: PayrollCalendarOptions;
}): PayrollDraftAbsencePeriod[] {
  const range = getPayrollMonthDateRange(monthId);
  const monthStart = dateToIsoDate(range.start);
  const monthEnd = dateToIsoDate(range.end);
  const calendar = createPayrollMonthCalendar(monthId, calendarOptions);

  return absences
    .map((absence) => {
      const overlap = overlapIsoRange(
        absence.startDate,
        absence.endDate,
        monthStart,
        monthEnd,
      );
      if (!overlap) {
        return null;
      }
      const workingDays = calendar.filter(
        (day) =>
          day.isoDate >= overlap.start &&
          day.isoDate <= overlap.end &&
          day.isWorkingDay &&
          isDateWithinEmploymentPeriod(day.isoDate, employment),
      ).length;

      return {
        id: absence.id,
        code: normalizeAbsenceCode(absence.absenceCode),
        startDate: absence.startDate,
        endDate: absence.endDate,
        workingDayCount: workingDays,
        workingHours:
          workingDays * (absence.hoursPerDay ?? STANDARD_WORKING_DAY_HOURS),
      };
    })
    .filter((period): period is PayrollDraftAbsencePeriod => period !== null)
    .sort((first, second) =>
      first.startDate === second.startDate
        ? first.id.localeCompare(second.id)
        : first.startDate.localeCompare(second.startDate),
    );
}

function calculateCompanyAccommodationDeduction({
  monthId,
  employee,
  settings,
  entitlements,
}: {
  monthId: MonthId;
  employee: Employee;
  settings: readonly PayrollSetting[];
  entitlements: EmployeeSettlementEntitlements | null;
}) {
  const assignment = entitlements?.companyAccommodation;
  if (!assignment) {
    return { media: 0, rent: 0, total: 0, warnings: [] };
  }

  if (!assignment.variantKey) {
    return {
      media: 0,
      rent: 0,
      total: 0,
      warnings: ['company-accommodation-missing-variant'] as const,
    };
  }

  const range = getPayrollMonthDateRange(monthId);
  const monthStart = dateToIsoDate(range.start);
  const monthEnd = dateToIsoDate(range.end);
  const contractStart = dateToIsoDate(
    assignment.contractStartDate ?? employee.employmentStartDate ?? range.start,
  );
  const contractEnd = assignment.contractEndDate
    ? dateToIsoDate(assignment.contractEndDate)
    : employee.employmentEndDate
      ? dateToIsoDate(employee.employmentEndDate)
      : monthEnd;
  const overlap = overlapIsoRange(
    contractStart,
    contractEnd,
    monthStart,
    monthEnd,
  );
  if (!overlap) {
    return { media: 0, rent: 0, total: 0, warnings: [] };
  }

  const chargedDays = countCalendarDaysInclusive(overlap.start, overlap.end);
  const monthDays = countCalendarDaysInclusive(monthStart, monthEnd);
  const rentSetting = resolveEffectivePayrollSetting(
    settings,
    'accommodation_allowance',
    monthId,
    assignment.variantKey,
  );

  if (!rentSetting) {
    return {
      media: 0,
      rent: 0,
      total: 0,
      warnings: ['unresolved-company-accommodation-variant'] as const,
    };
  }

  const mediaMonthly =
    resolveEffectivePayrollSetting(
      settings,
      'company_housing_media',
      monthId,
      assignment.variantKey,
    )?.amount ??
    configuredAmount(
      settings,
      'company_housing_media',
      monthId,
      DEFAULT_COMPANY_HOUSING_MEDIA,
    );
  const rentMonthly = rentSetting.amount;
  const media = roundMoney((mediaMonthly / monthDays) * chargedDays);
  const rent = roundMoney((rentMonthly / monthDays) * chargedDays);

  return { media, rent, total: roundMoney(media + rent), warnings: [] };
}

export function calculateEmployeeMonthlyDraft({
  monthId,
  employee,
  dailyValues,
  absences,
  payrollSettings,
  adjustments,
  entitlements = null,
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
  const baseSalaryBrutto = baseSalaryForFirstToyotaEmploymentDate(
    employee.firstToyotaEmploymentDate,
  );
  if (baseSalaryBrutto === null) {
    warnings.push(warning('missing-first-toyota-employment-date'));
  }
  if (!participatesInMonth) {
    warnings.push(warning('employee-not-participating'));
  }
  entitlements?.reviewWarnings?.forEach((code) => {
    warnings.push(warning(code));
  });

  const employeeDailyValues = dailyValues.filter((value) =>
    isEmployeeDailyValue(employee, value),
  );
  const dailyValuesByDate = new Map(
    employeeDailyValues.map((value) => [value.date, value]),
  );
  const activeAbsences = absences.filter((absence) =>
    isActiveEmployeeAbsence(employee, absence),
  );
  const payrollEffectiveAbsences = activeAbsences.filter(
    isPayrollEffectiveAbsence,
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
  const workTimeDeviations: DailyWorkTimeDeviation[] = [];
  const unresolvedClassificationDays: IsoDate[] = [];
  const physicallyWorkedDates = new Set<IsoDate>();

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
      const hasReportedL4 =
        absenceResolution.kind === 'governed' &&
        absenceResolution.code === 'L4' &&
        absenceResolution.confirmation === 'reported';
      const hasPayrollGoverningAbsence = hasGoverningAbsence && !hasReportedL4;

      if (absenceResolution.kind === 'ambiguous') {
        warnings.push(warning('ambiguous-absence', day.isoDate));
      } else if (hasReportedL4 && isWithinEmployment) {
        warnings.push(warning('unconfirmed-l4', day.isoDate));
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
          hasActiveAbsence: hasPayrollGoverningAbsence,
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
          if (effective.hours > 0 && !hasPayrollGoverningAbsence) {
            physicallyWorkedDates.add(day.isoDate);
          }
          const deviation = dailyWorkTimeDeviationFromValue({
            value: persistedValue,
            day,
          });
          if (deviation) {
            workTimeDeviations.push(deviation);
          } else if (effective.hours > 0 && !hasPayrollGoverningAbsence) {
            if (!day.isWorkingDay) {
              workTimeDeviations.push(
                resolveDailyWorkTimeDeviation({
                  planned: plannedIntervalForShift('FIRST'),
                  actual: {
                    startTime: '06:00',
                    endTime: addHoursToClockTime('06:00', effective.hours),
                  },
                  isWorkingDay: false,
                  isSaturday: day.date.getUTCDay() === 6,
                  isSunday: day.date.getUTCDay() === 0,
                  isPublicHoliday: day.isPublicHoliday,
                }),
              );
            } else if (effective.hours !== STANDARD_WORKING_DAY_HOURS) {
              unresolvedClassificationDays.push(day.isoDate);
              warnings.push(
                warning('unresolved-work-time-classification', day.isoDate),
              );
              workTimeDeviations.push({
                normalWorkHours: Math.min(
                  effective.hours,
                  STANDARD_WORKING_DAY_HOURS,
                ),
                privateTimeHours: Math.max(
                  0,
                  STANDARD_WORKING_DAY_HOURS - effective.hours,
                ),
                extraHours: Math.max(
                  0,
                  effective.hours - STANDARD_WORKING_DAY_HOURS,
                ),
                overtime50Hours: 0,
                overtime100Hours: 0,
                overtime100Reasons: [],
                coverableNiHours: 0,
                holidayWorkBonusEligible: false,
                nightOvertimeHours: 0,
                nightAllowanceHours: 0,
                unresolved: true,
              });
            } else {
              workTimeDeviations.push(
                resolveDailyWorkTimeDeviation({
                  planned: plannedIntervalForShift('FIRST'),
                  isWorkingDay: true,
                }),
              );
            }
          }
        }
        return;
      }

      const virtual = getPayrollVirtualDefaultHours({
        isWorkingDay: day.isWorkingDay,
        isWithinEmployment,
        hasGoverningValue: hasPayrollGoverningAbsence,
      });
      virtualHours += virtual ?? 0;
      if (virtual && !hasPayrollGoverningAbsence) {
        physicallyWorkedDates.add(day.isoDate);
        workTimeDeviations.push(
          resolveDailyWorkTimeDeviation({
            planned: plannedIntervalForShift('FIRST'),
            isWorkingDay: day.isWorkingDay,
            isSaturday: day.date.getUTCDay() === 6,
            isSunday: day.date.getUTCDay() === 0,
            isPublicHoliday: day.isPublicHoliday,
          }),
        );
      }
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
    absences: payrollEffectiveAbsences as AbsenceRuleRecord[],
  });
  if (!frequencySetting) {
    warnings.push(warning('unresolved-frequency-bonus-setting'));
  }
  const frequencyAmount = frequencySetting ? frequencyRule.amount : null;
  const absencePeriods = calculateAbsencePeriods({
    monthId,
    employment,
    absences: payrollEffectiveAbsences,
    calendarOptions,
  });
  const eligibleWorkingDays = countEligibleWorkingDays({
    monthId,
    employment,
    calendarOptions,
  });

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
  const workTimeBeforeBalance = workTimeDeviations.reduce(
    (total, deviation) => ({
      normalWorkHours: total.normalWorkHours + deviation.normalWorkHours,
      privateTimeHours: total.privateTimeHours + deviation.privateTimeHours,
      coverableNiHours: total.coverableNiHours + deviation.coverableNiHours,
      overtime50Hours: total.overtime50Hours + deviation.overtime50Hours,
      overtime100Hours: total.overtime100Hours + deviation.overtime100Hours,
      holidayWorkBonusEligible:
        total.holidayWorkBonusEligible || deviation.holidayWorkBonusEligible,
    }),
    {
      normalWorkHours: 0,
      privateTimeHours: 0,
      coverableNiHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      holidayWorkBonusEligible: false,
    },
  );
  const workTimeBalance = balanceMonthlyWorkTimeDeviations(
    workTimeBeforeBalance,
  );
  const hoursForCodes = (codes: ReadonlySet<string>) =>
    groups
      .filter((group) => codes.has(group.code))
      .reduce((total, group) => total + group.nominalHours, 0);
  const otherAbsenceHours = groups
    .filter(
      (group) => group.code !== 'L4' && !VACATION_ABSENCE_CODES.has(group.code),
    )
    .reduce((total, group) => total + group.nominalHours, 0);
  const holidayWorkBonusBrutto = workTimeBeforeBalance.holidayWorkBonusEligible
    ? configuredAmount(
        payrollSettings,
        'holiday_work_bonus',
        monthId,
        DEFAULT_HOLIDAY_WORK_BONUS,
      )
    : 0;
  const transportAllowanceNetto = prorateByWorkedDays({
    monthlyAmount: configuredAmount(
      payrollSettings,
      'transport_allowance',
      monthId,
      DEFAULT_TRANSPORT_ALLOWANCE,
    ),
    eligibleWorkingDays,
    physicallyWorkedDays: physicallyWorkedDates.size,
  });
  const laundryAllowanceBrutto = prorateByWorkedDays({
    monthlyAmount: configuredAmount(
      payrollSettings,
      'laundry_allowance',
      monthId,
      DEFAULT_LAUNDRY_ALLOWANCE,
    ),
    eligibleWorkingDays,
    physicallyWorkedDays: physicallyWorkedDates.size,
  });
  const udtAllowanceBrutto =
    entitlements?.udtEligible && fullCalendarMonth
      ? configuredAmount(
          payrollSettings,
          'udt_allowance',
          monthId,
          DEFAULT_UDT_ALLOWANCE,
        )
      : 0;
  const ownHousingSetting = resolveEffectivePayrollSetting(
    payrollSettings,
    'own_housing_allowance',
    monthId,
  );
  if (entitlements?.ownHousingAllowanceEligible && !ownHousingSetting) {
    warnings.push(warning('unresolved-own-housing-setting'));
  }
  const ownHousingAllowanceBrutto =
    entitlements?.ownHousingAllowanceEligible && fullCalendarMonth
      ? (ownHousingSetting?.amount ?? 0)
      : 0;
  const companyAccommodation = calculateCompanyAccommodationDeduction({
    monthId,
    employee,
    settings: payrollSettings,
    entitlements,
  });
  companyAccommodation.warnings.forEach((code) => {
    warnings.push(warning(code));
  });
  const bruttoAdditions = roundMoney(
    (frequencyAmount ?? 0) +
      holidayWorkBonusBrutto +
      udtAllowanceBrutto +
      laundryAllowanceBrutto +
      ownHousingAllowanceBrutto +
      manualIncreases,
  );
  const nettoAllowances = transportAllowanceNetto;
  const deductions = roundMoney(manualDecreases + companyAccommodation.total);
  const preliminaryGrossAdditions = roundMoney(
    (frequencyAmount ?? 0) +
      holidayWorkBonusBrutto +
      udtAllowanceBrutto +
      laundryAllowanceBrutto +
      ownHousingAllowanceBrutto +
      manualIncreases,
  );

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
      periods: absencePeriods,
      l4Hours: hoursForCodes(new Set(['L4'])),
      vacationHours: hoursForCodes(VACATION_ABSENCE_CODES),
      otherAbsenceHours,
      nnHours: hoursForCodes(new Set(['NN'])),
      approvedOrJustifiedHours: hoursForCodes(APPROVED_ABSENCE_CODES),
    },
    workDays: {
      eligibleWorkingDays,
      physicallyWorkedDays: physicallyWorkedDates.size,
    },
    workTime: {
      normalWorkHours: workTimeBeforeBalance.normalWorkHours,
      privateTimeHours: workTimeBalance.privateTimeHours,
      privateTimeCoveredHours: workTimeBalance.privateTimeCoveredHours,
      uncoveredPrivateTimeHours: workTimeBalance.uncoveredPrivateTimeHours,
      coverableNiHours: workTimeBalance.coverableNiHours,
      coverableNiCoveredHours: workTimeBalance.coverableNiCoveredHours,
      uncoveredCoverableNiHours: workTimeBalance.uncoveredCoverableNiHours,
      overtime50Hours: workTimeBalance.overtime50Hours,
      overtime100Hours: workTimeBalance.overtime100Hours,
      paidOvertime50Hours: workTimeBalance.paidOvertime50Hours,
      paidOvertime100Hours: workTimeBalance.paidOvertime100Hours,
      holidayWorkBonusEligible: workTimeBeforeBalance.holidayWorkBonusEligible,
      unresolvedClassificationDays,
      niedoczasHours: workTimeBalance.niedoczasHours,
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
    components: {
      baseSalaryBrutto,
      frequencyBonusBrutto: frequencyAmount,
      holidayWorkBonusBrutto,
      transportAllowanceNetto,
      udtAllowanceBrutto,
      laundryAllowanceBrutto,
      ownHousingAllowanceBrutto,
      manualIncreases,
      manualDecreases,
      companyAccommodationDeduction: companyAccommodation.total,
      companyAccommodationMediaDeduction: companyAccommodation.media,
      companyAccommodationRentDeduction: companyAccommodation.rent,
    },
    warnings,
    totals: {
      workedHours: explicitHours + virtualHours,
      nominalHours: individualNominalHours,
      frequencyBonusAmount: frequencyAmount,
      manualIncreases,
      manualDecreases,
      bruttoAdditions,
      nettoAllowances,
      deductions,
      preliminaryGrossAdditions,
      preliminaryGrossDeductions: deductions,
    },
  };
}

export function calculateMonthlyDrafts({
  employees,
  entitlementsByEmployeeId,
  ...input
}: MonthlyCalculationDraftsInput): EmployeeMonthlyCalculationDraft[] {
  return employees.map((employee) =>
    calculateEmployeeMonthlyDraft({
      ...input,
      employee,
      entitlements: entitlementsByEmployeeId?.get(employee.id) ?? null,
    }),
  );
}

function dailyWorkTimeDeviationFromValue({
  value,
  day,
}: {
  value: DailyValue;
  day: ReturnType<typeof createPayrollMonthCalendar>[number];
}): DailyWorkTimeDeviation | null {
  if (!value.workTimeCorrection) {
    return null;
  }

  const correction = value.workTimeCorrection;
  return resolveDailyWorkTimeDeviation({
    planned: {
      shift: correction.plannedShift,
      startTime: correction.plannedStartTime,
      endTime: correction.plannedEndTime,
    },
    actual: {
      startTime: correction.actualStartTime,
      endTime: correction.actualEndTime,
    },
    isWorkingDay: day.isWorkingDay,
    isSaturday: day.date.getUTCDay() === 6,
    isSunday: day.date.getUTCDay() === 0,
    isPublicHoliday: day.isPublicHoliday,
    classificationOverride: correction.classificationOverride
      ? {
          privateTimeHours: correction.classificationOverride.privateTimeHours,
          overtime50Hours: correction.classificationOverride.overtime50Hours,
          overtime100Hours: correction.classificationOverride.overtime100Hours,
          coverableNiHours: correction.classificationOverride.coverableNiHours,
        }
      : null,
  });
}

function addHoursToClockTime(startTime: string, hours: number): string {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = Math.round(hour! * 60 + minute! + hours * 60);
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${Math.floor(normalized / 60)
    .toString()
    .padStart(2, '0')}:${(normalized % 60).toString().padStart(2, '0')}`;
}
