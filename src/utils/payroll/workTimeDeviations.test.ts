import {
  balanceMonthlyWorkTimeDeviations,
  plannedIntervalForShift,
  resolveDailyWorkTimeDeviation,
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
      nightAllowanceHours: 2,
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
      nightAllowanceHours: 2,
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

  it('classifies Sunday work as combined 100% overtime', () => {
    const result = resolveDailyWorkTimeDeviation({
      planned: plannedIntervalForShift('NIGHT'),
      actual: { startTime: '22:00', endTime: '06:00' },
      isWorkingDay: false,
      isSunday: true,
    });

    expect(result.overtime100Hours).toBe(8);
    expect(result.overtime100Reasons).toEqual(['SUNDAY']);
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
