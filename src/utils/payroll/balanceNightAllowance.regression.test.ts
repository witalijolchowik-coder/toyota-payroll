import type { PlannedScheduleDay } from '../schedule';
import { balanceFacts } from '../attendance/balanceFixtures.test-support';
import {
  resolveBalanceCalendarDeviation,
  resolveBalanceSourceDeviation,
} from './balanceSourceDeviation';
import { plannedIntervalForShift } from './workTimeDeviations';

function manualNightPlan(
  overrides: Partial<PlannedScheduleDay> = {},
): PlannedScheduleDay {
  return {
    employeeId: 'employee-1',
    date: '2026-09-10',
    status: 'WORKING',
    source: 'manual-correction',
    hours: 8,
    shift: 'NIGHT',
    label: '8 / 3',
    departmentId: 'headliner-bmw',
    shiftAssignment: 'RED',
    reason: 'Manual planned shift',
    holidayName: null,
    plannedStartTime: '22:00',
    plannedEndTime: '06:00',
    plannedDuration: 8,
    ...overrides,
  };
}

describe('Balance source night facts versus payable scheduled night allowance', () => {
  it('L: keeps GODZ_NOC while SECOND night overtime receives no night allowance', () => {
    const facts = Object.freeze(
      balanceFacts({
        planned_start_time: '14:00',
        planned_end_time: '22:00',
        actual_start_time: '14:00',
        actual_end_time: '23:00',
        credited_hours: 9,
        extra_hours: 1,
        night_hours: 1,
        presence_hours: 9,
      }),
    );
    const before = { ...facts };
    const result = resolveBalanceCalendarDeviation(facts, '2026-09-10', false);
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      extraHours: 1,
      overtime50Hours: 0,
      overtime100Hours: 1,
      nightOvertimeHours: 1,
      nightAllowanceHours: 0,
      privateTimeHours: 0,
      unresolved: false,
    });
    expect(result.deviation.overtime100Reasons).toEqual(['NIGHT']);
    expect(result.issues).not.toContain('NIGHT_HOURS_DISCREPANCY');
    expect(facts).toEqual(before);
    expect(facts.night_hours).toBe(1);
  });

  it('preserves credited mixed overtime pools while excluding unscheduled night allowance', () => {
    const facts = balanceFacts({
      planned_start_time: '14:00',
      planned_end_time: '22:00',
      actual_start_time: '13:00',
      actual_end_time: '00:00',
      credited_hours: 11,
      extra_hours: 3,
      night_hours: 2,
      presence_hours: 11,
    });
    const result = resolveBalanceCalendarDeviation(facts, '2026-09-10', false);
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      extraHours: 3,
      overtime50Hours: 1,
      overtime100Hours: 2,
      nightOvertimeHours: 2,
      nightAllowanceHours: 0,
      privateTimeHours: 0,
      unresolved: false,
    });
    expect(result.issues).toEqual([]);
    expect(facts.credited_hours).toBe(11);
    expect(facts.extra_hours).toBe(3);
    expect(facts.night_hours).toBe(2);
  });

  it('M: preserves a full canonical NIGHT allowance and all source facts', () => {
    const facts = Object.freeze(
      balanceFacts({
        planned_start_time: '22:00',
        planned_end_time: '06:00',
        actual_start_time: '22:00',
        actual_end_time: '06:00',
        night_hours: 8,
      }),
    );
    const before = { ...facts };
    expect(
      resolveBalanceCalendarDeviation(facts, '2026-09-10', false).deviation,
    ).toMatchObject({
      normalWorkHours: 8,
      extraHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      nightOvertimeHours: 0,
      nightAllowanceHours: 8,
      unresolved: false,
    });
    expect(facts).toEqual(before);
  });

  it('counts only actual overlap for a partial NIGHT and preserves the shortage', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        planned_start_time: '22:00',
        planned_end_time: '06:00',
        actual_start_time: '00:00',
        actual_end_time: '06:00',
        credited_hours: 6,
        night_hours: 6,
        presence_hours: 6,
        private_time_hours: 2,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 6,
      privateTimeHours: 2,
      extraHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      nightAllowanceHours: 6,
    });
    expect(result.issues).toEqual([]);
  });

  it('N: infers a canonical SECOND plan without writing a shift into source facts', () => {
    const facts = balanceFacts({
      planned_start_time: '14:00',
      planned_end_time: '22:00',
      actual_start_time: '14:00',
      actual_end_time: '23:00',
      credited_hours: 9,
      extra_hours: 1,
      night_hours: 1,
      presence_hours: 9,
    });
    const result = resolveBalanceSourceDeviation(facts, {
      planned: { shift: null, startTime: '14:00', endTime: '22:00' },
      isWorkingDay: true,
      plannedSource: 'balance-plan',
    });
    expect(result.nightContext).toEqual({
      shift: 'SECOND',
      shiftSource: 'balance-plan',
      inferred: true,
      reviewReason: null,
    });
    expect(result.deviation.nightAllowanceHours).toBe(0);
    expect(result.deviation.overtime100Hours).toBe(1);
    expect(facts).not.toHaveProperty('shift');
  });

  it.each([
    { label: 'missing', planned: null, reason: 'MISSING_PLAN' },
    {
      label: 'non-canonical',
      planned: { shift: null, startTime: '07:00', endTime: '15:00' },
      reason: 'NON_CANONICAL_PLAN',
    },
    {
      label: 'contradictory',
      planned: {
        shift: 'NIGHT' as const,
        startTime: '14:00',
        endTime: '22:00',
      },
      reason: 'CONFLICTING_PLAN',
    },
  ])(
    'O: retains source allowance for a $label plan and requires review',
    ({ planned, reason }) => {
      const facts = balanceFacts({
        planned_start_time: planned?.startTime ?? null,
        planned_end_time: planned?.endTime ?? null,
        actual_start_time: '14:00',
        actual_end_time: '23:00',
        credited_hours: 9,
        extra_hours: 1,
        night_hours: 1,
        presence_hours: 9,
      });
      const before = { ...facts };
      const result = resolveBalanceSourceDeviation(facts, {
        planned,
        isWorkingDay: true,
      });
      expect(result.deviation.nightAllowanceHours).toBe(1);
      expect(result.deviation.unresolved).toBe(true);
      expect(result.nightContext.reviewReason).toBe(reason);
      expect(result.issues).toContain(`${reason}_NIGHT_ALLOWANCE_REVIEW`);
      expect(facts).toEqual(before);
    },
  );

  it('does not replace missing actual punches with planned NIGHT hours', () => {
    const result = resolveBalanceSourceDeviation(
      balanceFacts({
        night_hours: 3,
        actual_start_time: null,
        actual_end_time: null,
      }),
      { planned: plannedIntervalForShift('NIGHT'), isWorkingDay: true },
    );
    expect(result.deviation.nightAllowanceHours).toBe(3);
    expect(result.deviation.unresolved).toBe(true);
    expect(result.nightContext.reviewReason).toBe('MISSING_ACTUAL');
  });

  it('does not create a night-review blocker for an unrelated custom daytime plan', () => {
    const result = resolveBalanceSourceDeviation(
      balanceFacts({
        planned_start_time: '07:00',
        planned_end_time: '15:00',
        actual_start_time: '07:00',
        actual_end_time: '15:00',
      }),
      {
        planned: { shift: null, startTime: '07:00', endTime: '15:00' },
        isWorkingDay: true,
      },
    );
    expect(result.issues).toEqual([]);
    expect(result.deviation.unresolved).toBe(false);
    expect(result.deviation.nightAllowanceHours).toBe(0);
  });

  it('honors a protected manual NIGHT correction over raw Balance SECOND', () => {
    const facts = balanceFacts({
      planned_start_time: '14:00',
      planned_end_time: '22:00',
      actual_start_time: '22:00',
      actual_end_time: '06:00',
      night_hours: 8,
    });
    const before = { ...facts };
    const correction = Object.freeze(manualNightPlan());
    const result = resolveBalanceCalendarDeviation(
      facts,
      '2026-09-10',
      false,
      correction,
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      extraHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      nightAllowanceHours: 8,
    });
    expect(result.nightContext).toEqual({
      shift: 'NIGHT',
      shiftSource: 'manual-correction',
      inferred: false,
      reviewReason: null,
    });
    expect(facts).toEqual(before);
  });

  it('preserves allowance when a protected correction is explicitly ambiguous', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        planned_start_time: '14:00',
        planned_end_time: '22:00',
        actual_start_time: '14:00',
        actual_end_time: '23:00',
        credited_hours: 9,
        extra_hours: 1,
        night_hours: 1,
        presence_hours: 9,
      }),
      '2026-09-10',
      false,
      manualNightPlan({
        shift: 'SECOND',
        plannedStartTime: '14:00',
        plannedEndTime: '22:00',
        nightAllowanceReviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
      }),
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 1,
      nightOvertimeHours: 1,
      nightAllowanceHours: 1,
      unresolved: true,
    });
    expect(result.nightContext.reviewReason).toBe(
      'AMBIGUOUS_SCHEDULE_CORRECTION',
    );
  });

  it.each([
    { date: '2026-09-12', holiday: false },
    { date: '2026-09-13', holiday: false },
    { date: '2026-09-10', holiday: true },
  ])('retains non-working night stacking for $date', ({ date, holiday }) => {
    const facts = balanceFacts({
      planned_hours: 0,
      planned_start_time: null,
      planned_end_time: null,
      actual_start_time: '22:00',
      actual_end_time: '06:00',
      credited_hours: 8,
      extra_hours: 8,
      night_hours: 8,
      presence_hours: 8,
    });
    const result = resolveBalanceCalendarDeviation(facts, date, holiday);
    expect(result.deviation).toMatchObject({
      normalWorkHours: 0,
      extraHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 8,
      nightOvertimeHours: 8,
      nightAllowanceHours: 8,
      unresolved: false,
    });
    expect(result.issues).toEqual([]);
    expect(facts.night_hours).toBe(8);
  });

  it('does not apply ordinary-shift review or suppression to a corrected DAY_OFF', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        actual_start_time: '22:00',
        actual_end_time: '06:00',
        credited_hours: 8,
        extra_hours: 8,
        night_hours: 8,
      }),
      '2026-09-10',
      false,
      manualNightPlan({
        status: 'DAY_OFF',
        hours: 0,
        shift: null,
        plannedStartTime: null,
        plannedEndTime: null,
        plannedDuration: 0,
        nightAllowanceReviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
      }),
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 0,
      overtime100Hours: 8,
      overtime50Hours: 0,
      nightOvertimeHours: 8,
      nightAllowanceHours: 8,
      unresolved: false,
    });
    expect(result.issues).toEqual([]);
  });
});
