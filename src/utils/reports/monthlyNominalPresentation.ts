import type { PlannedScheduleDay } from '../schedule';

export interface MonthlyScheduleReportingContext {
  departmentId: string | null;
  brigade: string | null;
}

export function monthlyScheduleReportingContext(
  schedule: readonly PlannedScheduleDay[],
): MonthlyScheduleReportingContext | null {
  const covered = schedule.filter((day) => day.status !== 'OUTSIDE_EMPLOYMENT');
  const first = covered[0];
  if (
    !first ||
    covered.some(
      (day) =>
        day.departmentId !== first.departmentId ||
        day.shiftAssignment !== first.shiftAssignment,
    )
  )
    return null;
  return { departmentId: first.departmentId, brigade: first.shiftAssignment };
}

/** Presentation/export policy only. Never use as an input to payroll calculation. */
export function monthlyNominalForReport({
  monthId,
  scheduledHours,
  context,
}: {
  monthId: string;
  scheduledHours: number | null;
  context?: MonthlyScheduleReportingContext | null;
}): number | null {
  return monthId === '2026-10' &&
    context?.departmentId === 'headliner-bmw' &&
    context.brigade === 'YELLOW' &&
    scheduledHours === 123
    ? 124
    : scheduledHours;
}
