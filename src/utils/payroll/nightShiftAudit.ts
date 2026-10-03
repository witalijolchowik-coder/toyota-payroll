import type { ActualWorkingShift } from '../../types/firestore';
import {
  isValidClockTime,
  physicalNightHours,
  resolveScheduledNightAllowance,
  type ClockInterval,
  type DailyWorkTimeDeviation,
  type PlannedWorkInterval,
  type ScheduledNightAllowanceReviewReason,
} from './workTimeDeviations';

export type NightShiftAuditStatus =
  | 'OK_FIRST'
  | 'OK_SECOND'
  | 'OK_NIGHT'
  | 'CANONICAL_SHIFT_INFERRED'
  | 'NON_WORKING_DAY_UNCHANGED'
  | 'MISSING_SHIFT'
  | 'NON_CANONICAL_PLAN'
  | 'CONFLICTING_PLAN'
  | 'REVIEW_REQUIRED';

export interface NightShiftAuditInput {
  isWorkingDay: boolean;
  planned?: PlannedWorkInterval | null;
  actual?: ClockInterval | null;
  shiftSource: string;
  sourceNightHours: number;
  oldDeviation?: DailyWorkTimeDeviation | null;
  newDeviation?: DailyWorkTimeDeviation | null;
  reviewReason?: ScheduledNightAllowanceReviewReason | null;
}

/** Read-only audit classification. It never generates or changes source records. */
export function auditNightShift(input: NightShiftAuditInput): {
  included: boolean;
  effectiveShift: ActualWorkingShift | null;
  inferred: boolean;
  reviewReason: ScheduledNightAllowanceReviewReason | null;
  status: NightShiftAuditStatus;
} {
  const actualNight =
    input.actual &&
    isValidClockTime(input.actual.startTime) &&
    isValidClockTime(input.actual.endTime)
      ? physicalNightHours(input.actual)
      : 0;
  const included =
    input.sourceNightHours > 0 ||
    actualNight > 0 ||
    [input.oldDeviation, input.newDeviation].some(
      (deviation) =>
        deviation &&
        (deviation.nightAllowanceHours > 0 ||
          deviation.nightOvertimeHours > 0 ||
          deviation.overtime100Reasons.includes('NIGHT')),
    );
  if (!input.isWorkingDay) {
    return {
      included,
      effectiveShift: null,
      inferred: false,
      reviewReason: null,
      status: 'NON_WORKING_DAY_UNCHANGED',
    };
  }
  const resolved = resolveScheduledNightAllowance({
    planned: input.planned,
    actual: input.actual,
    fallbackNightAllowanceHours: input.oldDeviation?.nightAllowanceHours ?? 0,
  });
  const reviewReason = input.reviewReason ?? resolved.reviewReason;
  const status: NightShiftAuditStatus = reviewReason
    ? reviewReason === 'MISSING_PLAN'
      ? 'MISSING_SHIFT'
      : reviewReason === 'NON_CANONICAL_PLAN'
        ? 'NON_CANONICAL_PLAN'
        : reviewReason === 'CONFLICTING_PLAN' ||
            reviewReason === 'AMBIGUOUS_SCHEDULE_CORRECTION'
          ? 'CONFLICTING_PLAN'
          : 'REVIEW_REQUIRED'
    : resolved.inferred || input.shiftSource === 'balance-plan'
      ? 'CANONICAL_SHIFT_INFERRED'
      : (`OK_${resolved.shift}` as NightShiftAuditStatus);
  return {
    included,
    effectiveShift: resolved.shift,
    inferred:
      resolved.inferred ||
      (!reviewReason && input.shiftSource === 'balance-plan'),
    reviewReason,
    status,
  };
}
