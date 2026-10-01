import type {
  BalanceSourceFactsDocument,
  DailyValue,
} from '../../types/firestore';
import type { PlannedScheduleDay } from '../schedule';
import {
  intervalHours,
  resolveDailyWorkTimeDeviation,
  type DailyWorkTimeDeviation,
  type DailyWorkTimeDeviationInput,
  type PlannedWorkInterval,
} from './workTimeDeviations';

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const tolerance = 0.02;

export interface BalanceDeviationResult {
  deviation: DailyWorkTimeDeviation;
  issues: string[];
}

/** Credited quantity and GODZ_ZLEC govern; punches classify, never add hours. */
export function resolveBalanceSourceDeviation(
  facts: BalanceSourceFactsDocument,
  context: Omit<
    DailyWorkTimeDeviationInput,
    'actual' | 'classificationOverride'
  > & { plannedHours?: number },
): BalanceDeviationResult {
  const issues: string[] = [];
  const actual =
    facts.actual_start_time && facts.actual_end_time
      ? { startTime: facts.actual_start_time, endTime: facts.actual_end_time }
      : null;
  const planHours = context.isWorkingDay
    ? (context.plannedHours ?? facts.planned_hours)
    : 0;
  const extra = facts.extra_hours;
  if (extra > facts.credited_hours)
    issues.push('EXTRA_EXCEEDS_CREDITED_HOURS_REVIEW');
  if (facts.night_hours > facts.credited_hours)
    issues.push('NIGHT_EXCEEDS_CREDITED_HOURS');
  const normal = Math.max(0, facts.credited_hours - extra);
  const shortage = Math.max(0, planHours - normal);
  const analyzed =
    actual && (!context.isWorkingDay || context.planned)
      ? resolveDailyWorkTimeDeviation({ ...context, actual })
      : null;
  // A zero credited day without an authoritative absence is not proof of
  // eligible private time. Never consume overtime for unexplained absences.
  // Repaid/cumulative source balances are not new shortage demands either.
  const confirmedPrivate = Math.max(
    0,
    facts.private_time_hours - facts.private_time_repaid_hours,
  );
  const eligibleShortage = Math.min(
    shortage,
    Math.max(
      confirmedPrivate,
      normal > 0 ? (analyzed?.privateTimeHours ?? 0) : 0,
    ),
  );
  if (shortage - eligibleShortage > tolerance)
    issues.push('UNCONFIRMED_SHORTAGE_REVIEW');
  if (facts.credited_hours > 0 && !actual) issues.push('MISSING_PUNCH');
  if (
    analyzed &&
    Math.abs(analyzed.nightAllowanceHours - facts.night_hours) > 0.25
  )
    issues.push('NIGHT_HOURS_DISCREPANCY');
  if (actual) {
    const minutes = (t: string) =>
      Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const start = minutes(actual.startTime),
      end = minutes(actual.endTime);
    const presence = ((end - start + 1440) % 1440) / 60;
    if (Math.abs(presence - facts.presence_hours) > 0.25)
      issues.push('PRESENCE_DURATION_DISCREPANCY');
  }
  let overtime50 = 0,
    overtime100 = 0,
    nightExtra = 0;
  // When the complete normative interval is day-only or night-only, credited
  // GODZ_NOC determines the night part of the credited extra pool. Punches still
  // have to provide sufficient capacity in each category; rounding is not extra.
  const plannedNight = context.planned
    ? resolveDailyWorkTimeDeviation({
        planned: context.planned,
        actual: context.planned,
        isWorkingDay: true,
      }).nightAllowanceHours
    : null;
  const plannedLength = context.planned ? intervalHours(context.planned) : null;
  const sourceNightExtra =
    !context.isWorkingDay && normal <= tolerance
      ? facts.night_hours
      : plannedNight === 0
        ? facts.night_hours
        : plannedNight === plannedLength &&
            facts.night_hours + tolerance >= normal
          ? facts.night_hours - normal
          : null;
  const nightAllocationKnown =
    sourceNightExtra !== null &&
    sourceNightExtra >= -tolerance &&
    sourceNightExtra <= extra + tolerance &&
    (!analyzed ||
      (analyzed.nightOvertimeHours + tolerance >= sourceNightExtra &&
        analyzed.extraHours - analyzed.nightOvertimeHours + tolerance >=
          extra - sourceNightExtra));
  if (extra > 0 && extra <= facts.credited_hours) {
    if (!context.isWorkingDay) {
      overtime100 = Math.min(8, extra);
      overtime50 = Math.max(0, extra - 8);
      if (nightAllocationKnown)
        nightExtra = Math.min(extra, Math.max(0, sourceNightExtra!));
      else if (facts.night_hours === facts.credited_hours) nightExtra = extra;
      else if (facts.night_hours === 0) nightExtra = 0;
      else if (analyzed && Math.abs(analyzed.extraHours - extra) <= tolerance)
        nightExtra = analyzed.nightOvertimeHours;
      else issues.push('EXTRA_DAY_NIGHT_ALLOCATION_REVIEW');
    } else if (
      context.isSaturday ||
      context.isSunday ||
      context.isPublicHoliday
    ) {
      overtime100 = extra;
      if (nightAllocationKnown)
        nightExtra = Math.min(extra, Math.max(0, sourceNightExtra!));
      else if (analyzed && analyzed.nightOvertimeHours === 0) nightExtra = 0;
      else if (
        analyzed &&
        Math.abs(analyzed.nightOvertimeHours - analyzed.extraHours) <= tolerance
      )
        nightExtra = extra;
      else issues.push('EXTRA_DAY_NIGHT_ALLOCATION_REVIEW');
    } else if (nightAllocationKnown) {
      nightExtra = Math.min(extra, Math.max(0, sourceNightExtra!));
      overtime100 = nightExtra;
      overtime50 = extra - nightExtra;
    } else if (analyzed && analyzed.extraHours + tolerance >= extra) {
      if (analyzed.overtime100Hours <= tolerance) overtime50 = extra;
      else if (analyzed.overtime50Hours <= tolerance) {
        overtime100 = extra;
        nightExtra = extra;
      } else if (Math.abs(analyzed.extraHours - extra) <= tolerance) {
        overtime100 = analyzed.overtime100Hours;
        overtime50 = round(extra - overtime100);
        nightExtra = analyzed.nightOvertimeHours;
      } else issues.push('EXTRA_CLASSIFICATION_REVIEW');
    } else issues.push('EXTRA_CLASSIFICATION_REVIEW');
  }
  if (
    context.isWorkingDay &&
    !context.planned &&
    (extra > 0 || facts.credited_hours > 0)
  )
    issues.push('MISSING_PLANNED_INTERVAL');
  const unresolved = issues.some(
    (x) => x.includes('REVIEW') || x === 'MISSING_PLANNED_INTERVAL',
  );
  return {
    issues,
    deviation: {
      normalWorkHours: round(normal),
      privateTimeHours: round(eligibleShortage),
      extraHours: extra,
      overtime50Hours: round(overtime50),
      overtime100Hours: round(overtime100),
      overtime100Reasons:
        overtime100 > 0
          ? (analyzed?.overtime100Reasons ?? (nightExtra > 0 ? ['NIGHT'] : []))
          : [],
      coverableNiHours: 0,
      holidayWorkBonusEligible: Boolean(context.isPublicHoliday && extra > 0),
      nightOvertimeHours: round(nightExtra),
      nightAllowanceHours: Math.min(facts.credited_hours, facts.night_hours),
      unresolved,
    },
  };
}

/** Source plan is context only; a protected individual schedule remains higher. */
export function balancePlannedInterval(
  facts: BalanceSourceFactsDocument,
): PlannedWorkInterval | null {
  const start = facts.planned_start_time,
    end = facts.planned_end_time;
  if (!start || !end) return null;
  const shift =
    start === '06:00' && end === '14:00'
      ? 'FIRST'
      : start === '14:00' && end === '22:00'
        ? 'SECOND'
        : start === '22:00' && end === '06:00'
          ? 'NIGHT'
          : null;
  return { shift, startTime: start, endTime: end };
}

export function resolveBalanceCalendarDeviation(
  facts: BalanceSourceFactsDocument,
  date: string,
  isPublicHoliday: boolean,
  plannedDay?: PlannedScheduleDay,
): BalanceDeviationResult {
  const protectedPlan = plannedDay?.source === 'manual-correction';
  const planned = protectedPlan
    ? plannedDay.plannedStartTime && plannedDay.plannedEndTime
      ? {
          shift: plannedDay.shift,
          startTime: plannedDay.plannedStartTime,
          endTime: plannedDay.plannedEndTime,
        }
      : null
    : balancePlannedInterval(facts);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return resolveBalanceSourceDeviation(facts, {
    planned,
    plannedHours: protectedPlan ? (plannedDay.hours ?? 0) : facts.planned_hours,
    isWorkingDay: protectedPlan
      ? plannedDay.status === 'WORKING' || plannedDay.status === 'BHP'
      : facts.planned_hours > 0,
    isSaturday: weekday === 6,
    isSunday: weekday === 0,
    isPublicHoliday,
  });
}

export function hasEffectiveBalanceSource(
  value: Pick<
    DailyValue,
    'source' | 'manualOverride' | 'balanceSourceFacts' | 'workTimeCorrection'
  >,
): boolean {
  if (
    value.source !== 'attendance_import' ||
    value.manualOverride ||
    !value.balanceSourceFacts
  )
    return false;
  const correction = value.workTimeCorrection,
    facts = value.balanceSourceFacts;
  if (!correction) return true;
  const planned = balancePlannedInterval(facts),
    normative = facts.planned_hours > 0;
  // A later operator interval edit (or a protected legacy correction) must not
  // be superseded merely because raw source facts are attached to the record.
  return (
    correction.actualStartTime === facts.actual_start_time &&
    correction.actualEndTime === facts.actual_end_time &&
    (correction.workContext ?? 'NORMATIVE') ===
      (normative ? 'NORMATIVE' : 'EXTRA') &&
    correction.plannedShift === (normative ? planned?.shift : null) &&
    correction.plannedStartTime === (normative ? planned?.startTime : null) &&
    correction.plannedEndTime === (normative ? planned?.endTime : null) &&
    !correction.classificationOverride
  );
}
