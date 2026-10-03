import type { PlannedScheduleDay } from '../schedule';
import type { DailyWorkTimeDeviationInput } from './workTimeDeviations';

/** A protected day plan governs night eligibility, without reclassifying overtime. */
export function plannedNightContext(
  day?: PlannedScheduleDay,
): Pick<
  DailyWorkTimeDeviationInput,
  'nightAllowancePlanned' | 'nightAllowanceReviewReason'
> {
  return {
    ...(day?.source === 'manual-correction'
      ? {
          nightAllowancePlanned:
            day.plannedStartTime && day.plannedEndTime
              ? {
                  shift: day.shift,
                  startTime: day.plannedStartTime,
                  endTime: day.plannedEndTime,
                }
              : null,
        }
      : {}),
    nightAllowanceReviewReason: day?.nightAllowanceReviewReason,
  };
}
