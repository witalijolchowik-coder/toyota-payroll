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
  'ELIGIBLE' | 'PARTIAL_EMPLOYMENT' | 'NN_ABSENCE' | 'FOUR_OR_MORE_L4';

export interface FrequencyBonusResult {
  amount: number;
  l4RecordCount: number;
  hasNnAbsence: boolean;
  reason: FrequencyBonusReason;
}

export interface FrequencyBonusInput {
  monthId: MonthId;
  employment: EmploymentPeriod;
  absences: readonly AbsenceRuleRecord[];
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
}: FrequencyBonusInput): FrequencyBonusResult {
  if (!isEmployedForFullPayrollMonth(monthId, employment)) {
    return {
      amount: 0,
      l4RecordCount: 0,
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
  const hasNnAbsence = activeOverlapping.some(
    (absence) => normalizeAbsenceCode(absence.absenceCode) === 'NN',
  );
  const l4RecordCount = new Set(
    activeOverlapping
      .filter((absence) => normalizeAbsenceCode(absence.absenceCode) === 'L4')
      .map((absence) => absence.id),
  ).size;

  if (hasNnAbsence) {
    return {
      amount: 0,
      l4RecordCount,
      hasNnAbsence: true,
      reason: 'NN_ABSENCE',
    };
  }
  if (l4RecordCount >= 4) {
    return {
      amount: 0,
      l4RecordCount,
      hasNnAbsence: false,
      reason: 'FOUR_OR_MORE_L4',
    };
  }

  return {
    amount:
      FREQUENCY_BONUS_AMOUNTS[
        l4RecordCount as keyof typeof FREQUENCY_BONUS_AMOUNTS
      ],
    l4RecordCount,
    hasNnAbsence: false,
    reason: 'ELIGIBLE',
  };
}
