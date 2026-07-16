import type { AbsenceRuleRecord } from '../absences';
import { absenceRangesOverlap, normalizeAbsenceCode } from '../absences';
import type { MonthId } from '../../types/firestore';
import type { EmploymentPeriod } from '../payroll';
import { dateToIsoDate, getPayrollMonthDateRange } from '../payroll';

export const FREQUENCY_BONUS_AMOUNTS = {
  0: 400,
  1: 350,
  2: 300,
  3: 200,
  4: 0,
} as const;

export type FrequencyBonusReason =
  'ELIGIBLE' | 'PARTIAL_EMPLOYMENT' | 'FOUR_OR_MORE_L4_DAYS';

export interface FrequencyBonusResult {
  amount: number;
  l4RecordCount: number;
  l4MissedWorkingDayCount: number;
  hasNnAbsence: boolean;
  reason: FrequencyBonusReason;
}

export interface FrequencyBonusInput {
  monthId: MonthId;
  employment: EmploymentPeriod;
  absences: readonly AbsenceRuleRecord[];
  plannedWorkingDates?: ReadonlySet<string>;
}

export function isEmployedForFullPayrollMonth(
  monthId: MonthId,
  employment: EmploymentPeriod,
): boolean {
  if (!employment.employmentStart) {
    return false;
  }

  const range = getPayrollMonthDateRange(monthId);
  const employmentStart = dateToIsoDate(employment.employmentStart);
  const employmentEnd = employment.employmentEnd
    ? dateToIsoDate(employment.employmentEnd)
    : null;

  return (
    employmentStart <= dateToIsoDate(range.start) &&
    (!employmentEnd || employmentEnd >= dateToIsoDate(range.end))
  );
}

export function calculateFrequencyBonus({
  monthId,
  employment,
  absences,
  plannedWorkingDates,
}: FrequencyBonusInput): FrequencyBonusResult {
  if (!isEmployedForFullPayrollMonth(monthId, employment)) {
    return {
      amount: 0,
      l4RecordCount: 0,
      l4MissedWorkingDayCount: 0,
      hasNnAbsence: false,
      reason: 'PARTIAL_EMPLOYMENT',
    };
  }

  const range = getPayrollMonthDateRange(monthId);
  const monthRange = {
    startDate: dateToIsoDate(range.start),
    endDate: dateToIsoDate(range.end),
  };
  const activeOverlapping = absences.filter(
    (absence) =>
      absence.status === 'ACTIVE' && absenceRangesOverlap(absence, monthRange),
  );
  const l4Absences = activeOverlapping.filter(
    (absence) => normalizeAbsenceCode(absence.absenceCode) === 'L4',
  );
  const l4RecordCount = new Set(l4Absences.map((absence) => absence.id)).size;
  const l4MissedWorkingDayCount = countL4MissedWorkingDays({
    absences: l4Absences,
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    plannedWorkingDates,
  });

  if (l4MissedWorkingDayCount >= 4) {
    return {
      amount: 0,
      l4RecordCount,
      l4MissedWorkingDayCount,
      hasNnAbsence: false,
      reason: 'FOUR_OR_MORE_L4_DAYS',
    };
  }

  return {
    amount:
      FREQUENCY_BONUS_AMOUNTS[
        l4MissedWorkingDayCount as keyof typeof FREQUENCY_BONUS_AMOUNTS
      ],
    l4RecordCount,
    l4MissedWorkingDayCount,
    hasNnAbsence: false,
    reason: 'ELIGIBLE',
  };
}

function countL4MissedWorkingDays({
  absences,
  monthStart,
  monthEnd,
  plannedWorkingDates,
}: {
  absences: readonly AbsenceRuleRecord[];
  monthStart: string;
  monthEnd: string;
  plannedWorkingDates?: ReadonlySet<string>;
}) {
  const dates =
    plannedWorkingDates ?? defaultMondayFridayDates(monthStart, monthEnd);
  return [...dates].filter(
    (date) =>
      date >= monthStart &&
      date <= monthEnd &&
      absences.some(
        (absence) => absence.startDate <= date && absence.endDate >= date,
      ),
  ).length;
}

function defaultMondayFridayDates(startDate: string, endDate: string) {
  const result = new Set<string>();
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      result.add(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
