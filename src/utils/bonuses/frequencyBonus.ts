import type { AbsenceRuleRecord } from '../absences';
import {
  absenceRangesOverlap,
  effectiveAbsenceCode,
  isOvertimeTimeOffAbsence,
} from '../absences';
import type {
  FrequencyBonusThresholdScale,
  MonthId,
} from '../../types/firestore';
import type { EmploymentPeriod } from '../payroll/employment';
import { dateToIsoDate, getPayrollMonthDateRange } from '../payroll/month';
import { DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE } from '../payroll/settings';

export const FREQUENCY_BONUS_AMOUNTS = DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE;

export type FrequencyBonusReason =
  | 'ELIGIBLE'
  | 'PARTIAL_EMPLOYMENT'
  | 'FOUR_OR_MORE_AFFECTING_DAYS'
  | 'NN_ABSENCE';

export interface FrequencyBonusResult {
  amount: number;
  l4RecordCount: number;
  l4MissedWorkingDayCount: number;
  affectingAbsenceDayCount: number;
  hasNnAbsence: boolean;
  reason: FrequencyBonusReason;
}

export interface FrequencyBonusInput {
  monthId: MonthId;
  employment: EmploymentPeriod;
  absences: readonly AbsenceRuleRecord[];
  plannedWorkingDates?: ReadonlySet<string>;
  thresholdScale?: FrequencyBonusThresholdScale | null;
  fullConfiguredAmount?: number | null;
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
  thresholdScale = DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE,
  fullConfiguredAmount = null,
}: FrequencyBonusInput): FrequencyBonusResult {
  if (!isEmployedForFullPayrollMonth(monthId, employment)) {
    return {
      amount: 0,
      l4RecordCount: 0,
      l4MissedWorkingDayCount: 0,
      affectingAbsenceDayCount: 0,
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
    (absence) => effectiveAbsenceCode(absence) === 'L4',
  );
  const l4RecordCount = new Set(l4Absences.map((absence) => absence.id)).size;
  const l4MissedWorkingDayCount = countAbsenceWorkingDays({
    absences: l4Absences,
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    plannedWorkingDates,
  });
  const hasNnAbsence = activeOverlapping.some(
    (absence) => effectiveAbsenceCode(absence) === 'NN',
  );
  const affectingAbsenceDayCount = countAbsenceWorkingDays({
    absences: activeOverlapping.filter(
      (absence) =>
        ATTENDANCE_AFFECTING_CODES.has(effectiveAbsenceCode(absence)) &&
        !isOvertimeTimeOffAbsence(absence),
    ),
    monthStart: monthRange.startDate,
    monthEnd: monthRange.endDate,
    plannedWorkingDates,
  });

  const effectiveScale =
    thresholdScale ?? DEFAULT_FREQUENCY_BONUS_THRESHOLD_SCALE;
  if (hasNnAbsence) {
    return {
      amount: 0,
      l4RecordCount,
      l4MissedWorkingDayCount,
      affectingAbsenceDayCount,
      hasNnAbsence,
      reason: 'NN_ABSENCE',
    };
  }
  if (affectingAbsenceDayCount >= 4) {
    return {
      amount: effectiveScale[4],
      l4RecordCount,
      l4MissedWorkingDayCount,
      affectingAbsenceDayCount,
      hasNnAbsence,
      reason: 'FOUR_OR_MORE_AFFECTING_DAYS',
    };
  }

  return {
    amount:
      affectingAbsenceDayCount === 0 && fullConfiguredAmount !== null
        ? fullConfiguredAmount
        : effectiveScale[
            affectingAbsenceDayCount as keyof FrequencyBonusThresholdScale
          ],
    l4RecordCount,
    l4MissedWorkingDayCount,
    affectingAbsenceDayCount,
    hasNnAbsence,
    reason: 'ELIGIBLE',
  };
}

const ATTENDANCE_AFFECTING_CODES = new Set([
  'NI',
  'UB',
  'OP',
  'L4',
  'O5',
  'SR',
]);

function countAbsenceWorkingDays({
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
