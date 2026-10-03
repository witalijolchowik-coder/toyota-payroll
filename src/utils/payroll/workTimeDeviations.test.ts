import {
  balanceMonthlyWorkTimeDeviations,
  physicalNightHours,
  plannedIntervalForShift,
  resolveDailyWorkTimeDeviation,
  resolveScheduledNightAllowance,
} from './workTimeDeviations';

describe('daily work-time deviations', () => {
  it('treats the default planned shift as 8h normal work', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      privateTimeHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
    });
  });

  it('treats equal actual start and end as zero worked hours', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '06:00', endTime: '06:00' },
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 0,
      privateTimeHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 0,
    });
  });

  it('classifies late start and late finish as private time plus covering extra time', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '09:00', endTime: '17:00' },
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 5,
      privateTimeHours: 3,
      overtime50Hours: 3,
      overtime100Hours: 0,
    });
  });

  it('classifies daytime working-day overtime as 50%', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '06:00', endTime: '16:00' },
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      overtime50Hours: 2,
      overtime100Hours: 0,
    });
  });

  it('classifies second-shift night overtime as 100%', () => {
    const result = resolveDailyWorkTimeDeviation({
      planned: plannedIntervalForShift('SECOND'),
      actual: { startTime: '14:00', endTime: '00:00' },
      isWorkingDay: true,
    });

    expect(result).toMatchObject({
      normalWorkHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 2,
      nightOvertimeHours: 2,
      nightAllowanceHours: 0,
    });
    expect(result.overtime100Reasons).toContain('NIGHT');
  });

  it('classifies early first-shift night overtime as 100%', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '04:00', endTime: '14:00' },
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 2,
      nightOvertimeHours: 2,
      nightAllowanceHours: 0,
    });
  });

  it('classifies Saturday work as 100% without creating missing nominal hours', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '06:00', endTime: '10:00' },
        isWorkingDay: false,
        isSaturday: true,
      }),
    ).toMatchObject({
      normalWorkHours: 0,
      privateTimeHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 4,
    });
  });

  it.each([
    { hours: 4, endTime: '10:00', overtime100Hours: 4, overtime50Hours: 0 },
    { hours: 8, endTime: '14:00', overtime100Hours: 8, overtime50Hours: 0 },
    {
      hours: 8.5,
      endTime: '14:30',
      overtime100Hours: 8,
      overtime50Hours: 0.5,
    },
    { hours: 13, endTime: '19:00', overtime100Hours: 8, overtime50Hours: 5 },
  ])(
    'splits $hours hours of extra work at the eight-hour threshold',
    ({ endTime, overtime100Hours, overtime50Hours }) => {
      expect(
        resolveDailyWorkTimeDeviation({
          planned: null,
          actual: { startTime: '06:00', endTime },
          isWorkingDay: false,
        }),
      ).toMatchObject({
        normalWorkHours: 0,
        privateTimeHours: 0,
        overtime100Hours,
        overtime50Hours,
      });
    },
  );

  it('classifies Sunday work as combined 100% overtime', () => {
    const result = resolveDailyWorkTimeDeviation({
      planned: plannedIntervalForShift('NIGHT'),
      actual: { startTime: '22:00', endTime: '06:00' },
      isWorkingDay: false,
      isSunday: true,
    });

    expect(result.overtime100Hours).toBe(8);
    expect(result.overtime100Reasons).toEqual(['SUNDAY']);
    expect(result.nightAllowanceHours).toBe(8);
    expect(result.nightOvertimeHours).toBe(8);
  });

  it('marks public-holiday work as 100% and bonus eligible', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '06:00', endTime: '14:00' },
        isWorkingDay: false,
        isPublicHoliday: true,
      }),
    ).toMatchObject({
      overtime100Hours: 8,
      holidayWorkBonusEligible: true,
      nightAllowanceHours: 0,
    });
  });

  it('supports manual classification override', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('FIRST'),
        actual: { startTime: '06:00', endTime: '16:00' },
        isWorkingDay: true,
        classificationOverride: {
          overtime50Hours: 0,
          overtime100Hours: 2,
        },
      }),
    ).toMatchObject({
      overtime50Hours: 0,
      overtime100Hours: 2,
    });
  });

  it.each([
    ['SECOND', '14:00', '23:00', 8, 0, 1, 0, 1, 1, 0],
    ['SECOND', '14:00', '00:00', 8, 0, 2, 0, 2, 2, 0],
    ['FIRST', '05:00', '14:00', 8, 0, 1, 0, 1, 1, 0],
    ['FIRST', '04:00', '14:00', 8, 0, 2, 0, 2, 2, 0],
    ['NIGHT', '22:00', '06:00', 8, 0, 0, 0, 0, 0, 8],
    ['NIGHT', '00:00', '06:00', 6, 2, 0, 0, 0, 0, 6],
    ['NIGHT', '22:00', '07:00', 8, 0, 1, 1, 0, 0, 8],
    ['NIGHT', '21:00', '06:00', 8, 0, 1, 1, 0, 0, 8],
  ] as const)(
    'limits ordinary %s night allowance to planned actual overlap %s–%s',
    (
      shift,
      startTime,
      endTime,
      normalWorkHours,
      privateTimeHours,
      extraHours,
      overtime50Hours,
      overtime100Hours,
      nightOvertimeHours,
      nightAllowanceHours,
    ) => {
      expect(
        resolveDailyWorkTimeDeviation({
          planned: plannedIntervalForShift(shift),
          actual: { startTime, endTime },
          isWorkingDay: true,
        }),
      ).toEqual({
        normalWorkHours,
        privateTimeHours,
        extraHours,
        overtime50Hours,
        overtime100Hours,
        overtime100Reasons: nightOvertimeHours > 0 ? ['NIGHT'] : [],
        coverableNiHours: 0,
        holidayWorkBonusEligible: false,
        nightOvertimeHours,
        nightAllowanceHours,
        unresolved: false,
      });
    },
  );

  it.each([
    { isSaturday: true, reason: 'SATURDAY' },
    { isSunday: true, reason: 'SUNDAY' },
    { isPublicHoliday: true, reason: 'PUBLIC_HOLIDAY' },
  ])(
    'preserves $reason extra-night allowance stacking',
    ({ reason, ...flags }) => {
      expect(
        resolveDailyWorkTimeDeviation({
          // A stale weekday plan must not apply weekday suppression to extra work.
          planned: plannedIntervalForShift('SECOND'),
          actual: { startTime: '22:00', endTime: '06:00' },
          isWorkingDay: false,
          ...flags,
        }),
      ).toEqual({
        normalWorkHours: 0,
        privateTimeHours: 0,
        extraHours: 8,
        overtime50Hours: 0,
        overtime100Hours: 8,
        overtime100Reasons: [reason],
        coverableNiHours: 0,
        holidayWorkBonusEligible: reason === 'PUBLIC_HOLIDAY',
        nightOvertimeHours: 8,
        nightAllowanceHours: 8,
        unresolved: false,
      });
    },
  );

  it('preserves extra-night stacking above the eight-hour threshold', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        actual: { startTime: '21:00', endTime: '07:00' },
        isWorkingDay: false,
        isSaturday: true,
      }),
    ).toMatchObject({
      extraHours: 10,
      overtime100Hours: 8,
      overtime50Hours: 2,
      nightOvertimeHours: 8,
      nightAllowanceHours: 8,
      unresolved: false,
    });
  });

  it('retains the previous night value for a non-canonical plan and flags review', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: { shift: 'FIRST', startTime: '07:00', endTime: '15:00' },
        actual: { startTime: '05:00', endTime: '15:00' },
        isWorkingDay: true,
      }),
    ).toEqual({
      normalWorkHours: 8,
      privateTimeHours: 0,
      extraHours: 2,
      overtime50Hours: 1,
      overtime100Hours: 1,
      overtime100Reasons: ['NIGHT'],
      coverableNiHours: 0,
      holidayWorkBonusEligible: false,
      nightOvertimeHours: 1,
      nightAllowanceHours: 1,
      unresolved: true,
    });
  });

  it('does not let a classification override hide conflicting night-plan context', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: { shift: 'FIRST', startTime: '14:00', endTime: '22:00' },
        actual: { startTime: '14:00', endTime: '23:00' },
        isWorkingDay: true,
        classificationOverride: { overtime50Hours: 1, overtime100Hours: 0 },
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      extraHours: 1,
      overtime50Hours: 1,
      overtime100Hours: 0,
      nightOvertimeHours: 1,
      nightAllowanceHours: 1,
      unresolved: true,
    });
  });

  it('does not introduce night review for an unrelated custom daytime plan', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: { shift: 'FIRST', startTime: '07:00', endTime: '15:00' },
        actual: { startTime: '07:00', endTime: '15:00' },
        isWorkingDay: true,
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      extraHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      nightAllowanceHours: 0,
      unresolved: false,
    });
  });

  it('uses a protected night plan for allowance without changing the stored overtime plan', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('SECOND'),
        nightAllowancePlanned: plannedIntervalForShift('NIGHT'),
        actual: { startTime: '22:00', endTime: '06:00' },
        isWorkingDay: true,
      }),
    ).toEqual({
      normalWorkHours: 0,
      privateTimeHours: 8,
      extraHours: 8,
      overtime50Hours: 0,
      overtime100Hours: 8,
      overtime100Reasons: ['NIGHT'],
      coverableNiHours: 0,
      holidayWorkBonusEligible: false,
      nightOvertimeHours: 8,
      nightAllowanceHours: 8,
      unresolved: false,
    });
  });

  it('preserves physical night allowance when a protected schedule correction is ambiguous', () => {
    expect(
      resolveDailyWorkTimeDeviation({
        planned: plannedIntervalForShift('SECOND'),
        nightAllowancePlanned: plannedIntervalForShift('SECOND'),
        nightAllowanceReviewReason: 'AMBIGUOUS_SCHEDULE_CORRECTION',
        actual: { startTime: '14:00', endTime: '23:00' },
        isWorkingDay: true,
        classificationOverride: { overtime100Hours: 1 },
      }),
    ).toMatchObject({
      normalWorkHours: 8,
      privateTimeHours: 0,
      extraHours: 1,
      overtime50Hours: 0,
      overtime100Hours: 1,
      nightOvertimeHours: 1,
      nightAllowanceHours: 1,
      unresolved: true,
    });
  });
});

describe('scheduled versus physical night time', () => {
  it.each(['FIRST', 'SECOND', 'NIGHT'] as const)(
    'safely infers %s only from an exact canonical interval',
    (shift) => {
      const plan = { ...plannedIntervalForShift(shift), shift: null };
      expect(
        resolveScheduledNightAllowance({
          planned: plan,
          actual: plan,
          fallbackNightAllowanceHours: 13,
        }),
      ).toEqual({
        nightAllowanceHours: shift === 'NIGHT' ? 8 : 0,
        shift,
        inferred: true,
        reviewReason: null,
      });
    },
  );

  it.each([
    { planned: null, reviewReason: 'MISSING_PLAN' },
    {
      planned: { shift: null, startTime: '14:30', endTime: '22:30' },
      reviewReason: 'NON_CANONICAL_PLAN',
    },
    {
      planned: {
        shift: 'NIGHT' as const,
        startTime: '14:00',
        endTime: '22:00',
      },
      reviewReason: 'CONFLICTING_PLAN',
    },
  ])('does not guess on $reviewReason', ({ planned, reviewReason }) => {
    expect(
      resolveScheduledNightAllowance({
        planned,
        actual: { startTime: '14:00', endTime: '23:00' },
        fallbackNightAllowanceHours: 1,
      }),
    ).toEqual({
      nightAllowanceHours: 1,
      shift: null,
      inferred: false,
      reviewReason,
    });
  });

  it('preserves the prior allowance when actual punches are missing', () => {
    expect(
      resolveScheduledNightAllowance({
        planned: plannedIntervalForShift('NIGHT'),
        actual: null,
        fallbackNightAllowanceHours: 6,
      }),
    ).toMatchObject({
      nightAllowanceHours: 6,
      shift: 'NIGHT',
      reviewReason: 'MISSING_ACTUAL',
    });
  });

  it('preserves the prior allowance when actual punches are invalid', () => {
    expect(
      resolveScheduledNightAllowance({
        planned: plannedIntervalForShift('NIGHT'),
        actual: { startTime: '25:00', endTime: '06:00' },
        fallbackNightAllowanceHours: 6,
      }),
    ).toMatchObject({
      nightAllowanceHours: 6,
      shift: 'NIGHT',
      reviewReason: 'INVALID_ACTUAL',
    });
  });

  it('preserves physical night information independently of payable night hours', () => {
    const actual = { startTime: '14:00', endTime: '23:00' };
    const planned = plannedIntervalForShift('SECOND');
    expect(physicalNightHours(actual, planned)).toBe(1);
    expect(
      resolveScheduledNightAllowance({
        planned,
        actual,
        fallbackNightAllowanceHours: 1,
      }).nightAllowanceHours,
    ).toBe(0);
    expect(
      physicalNightHours(
        { startTime: '00:00', endTime: '06:00' },
        plannedIntervalForShift('NIGHT'),
      ),
    ).toBe(6);
  });
});

describe('monthly work-time balancing', () => {
  it('covers private time with overtime regardless of date order', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 1,
        coverableNiHours: 0,
        overtime50Hours: 2,
        overtime100Hours: 0,
      }),
    ).toMatchObject({
      privateTimeCoveredHours: 1,
      paidOvertime50Hours: 1,
      niedoczasHours: 0,
    });
  });

  it('leaves uncovered private time as niedoczas', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 3,
        coverableNiHours: 0,
        overtime50Hours: 1,
        overtime100Hours: 0,
      }),
    ).toMatchObject({
      privateTimeCoveredHours: 1,
      uncoveredPrivateTimeHours: 2,
      niedoczasHours: 2,
    });
  });

  it('covers shift-displacement NI only when explicitly marked as coverable', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 0,
        coverableNiHours: 8,
        overtime50Hours: 0,
        overtime100Hours: 8,
      }),
    ).toMatchObject({
      coverableNiCoveredHours: 8,
      paidOvertime100Hours: 0,
      niedoczasHours: 0,
    });
  });

  it('does not cover ordinary NI unless it is provided as coverable NI', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 0,
        coverableNiHours: 0,
        overtime50Hours: 0,
        overtime100Hours: 8,
      }),
    ).toMatchObject({
      coverableNiCoveredHours: 0,
      paidOvertime100Hours: 8,
      niedoczasHours: 0,
    });
  });

  it('keeps all 100% overtime in one combined bucket', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 0,
        coverableNiHours: 0,
        overtime50Hours: 0,
        overtime100Hours: 14,
      }).paidOvertime100Hours,
    ).toBe(14);
  });

  it('reserves explicitly linked 100% hours before ordinary shortage allocation', () => {
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: 4,
        coverableNiHours: 0,
        overtime50Hours: 4,
        overtime100Hours: 8,
        preferredOvertime100CoverageHours: 8,
      }),
    ).toMatchObject({
      preferredOvertime100CoverageHours: 8,
      privateTimeCoveredHours: 4,
      paidOvertime50Hours: 0,
      paidOvertime100Hours: 0,
    });
  });
});
