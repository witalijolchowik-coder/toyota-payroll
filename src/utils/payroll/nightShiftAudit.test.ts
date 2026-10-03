import { describe, expect, it } from 'vitest';
import { auditNightShift } from './nightShiftAudit';
import { plannedNightContext } from './plannedNightContext';
import { plannedIntervalForShift } from './workTimeDeviations';
import type { PlannedScheduleDay } from '../schedule';

describe('read-only night shift audit', () => {
  const base = {
    isWorkingDay: true,
    planned: plannedIntervalForShift('SECOND'),
    actual: { startTime: '14:00', endTime: '23:00' },
    shiftSource: 'explicit-plan',
    sourceNightHours: 1,
  };
  it('identifies a reliable SECOND shift without confusing extra night with allowance', () => {
    expect(auditNightShift(base)).toMatchObject({
      included: true,
      effectiveShift: 'SECOND',
      status: 'OK_SECOND',
      reviewReason: null,
    });
  });
  it('reports safe canonical Balance inference', () => {
    expect(
      auditNightShift({
        ...base,
        shiftSource: 'balance-plan',
        planned: { ...base.planned, shift: null },
      }),
    ).toMatchObject({
      effectiveShift: 'SECOND',
      inferred: true,
      status: 'CANONICAL_SHIFT_INFERRED',
    });
  });
  it.each([
    [null, 'MISSING_SHIFT'],
    [
      { shift: null, startTime: '13:00', endTime: '21:00' },
      'NON_CANONICAL_PLAN',
    ],
    [
      { shift: 'FIRST', startTime: '14:00', endTime: '22:00' },
      'CONFLICTING_PLAN',
    ],
  ] as const)(
    'reports ambiguous context without guessing',
    (planned, status) => {
      expect(auditNightShift({ ...base, planned })).toMatchObject({
        status,
        inferred: false,
      });
    },
  );
  it('reports duplicate protected corrections for review', () => {
    expect(
      auditNightShift({
        ...base,
        reviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
      }),
    ).toMatchObject({
      status: 'CONFLICTING_PLAN',
      reviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
    });
  });
  it('preserves the non-working branch even with no plan', () => {
    expect(
      auditNightShift({ ...base, isWorkingDay: false, planned: null }),
    ).toMatchObject({
      status: 'NON_WORKING_DAY_UNCHANGED',
      reviewReason: null,
    });
  });
  it('does not hide conflicting ACTIVE corrections behind a day off', () => {
    expect(
      auditNightShift({
        ...base,
        isWorkingDay: false,
        reviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
      }),
    ).toMatchObject({
      status: 'CONFLICTING_PLAN',
      reviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
    });
  });
  it('excludes unrelated daytime dates', () => {
    expect(
      auditNightShift({
        ...base,
        actual: { startTime: '14:00', endTime: '22:00' },
        sourceNightHours: 0,
      }).included,
    ).toBe(false);
  });
  it('uses only protected day plans to override stored night context', () => {
    const day = {
      source: 'manual-correction',
      shift: 'NIGHT',
      plannedStartTime: '22:00',
      plannedEndTime: '06:00',
    } as PlannedScheduleDay;
    expect(plannedNightContext(day).nightAllowancePlanned).toEqual(
      plannedIntervalForShift('NIGHT'),
    );
    expect(
      plannedNightContext({ ...day, source: 'automatic' })
        .nightAllowancePlanned,
    ).toBeUndefined();
  });
});
