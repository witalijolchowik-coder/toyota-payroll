import type { IsoDate } from '../../types/firestore';
import {
  calculateEmployeeNominalHours,
  calculateMonthNominalHours,
  classifyPayrollDate,
  createPayrollMonthCalendar,
  employeeParticipatesInPayrollMonth,
  getPayrollMonthDateRange,
  getPayrollVirtualDefaultHours,
  getUiVirtualDefaultHours,
  isDateWithinEmploymentPeriod,
  isPayrollWorkingDay,
  listPayrollMonthDates,
  STANDARD_WORKING_DAY_HOURS,
  virtualWorkedHoursDefaultApplies,
  type EmploymentPeriod,
  type PayrollCalendarOptions,
  type PayrollDayClassification,
} from '.';

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function employment(
  start: string | null,
  end: string | null = null,
): EmploymentPeriod {
  return {
    employmentStart: start ? utcDate(start) : null,
    employmentEnd: end ? utcDate(end) : null,
  };
}

function overrides(
  entries: [IsoDate, PayrollDayClassification][],
): ReadonlyMap<IsoDate, PayrollDayClassification> {
  return new Map(entries);
}

describe('payroll month date range', () => {
  it('returns every date in an inclusive leap-year month', () => {
    const range = getPayrollMonthDateRange('2024-02');
    const dates = listPayrollMonthDates('2024-02');

    expect(range.start.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    expect(dates).toHaveLength(29);
    expect(dates[0]?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(dates.at(-1)?.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

describe('working-day detection and calendar overrides', () => {
  it('treats Monday-Friday as working and weekends as non-working', () => {
    expect(isPayrollWorkingDay(utcDate('2026-06-01'))).toBe(true);
    expect(isPayrollWorkingDay(utcDate('2026-06-06'))).toBe(false);
    expect(isPayrollWorkingDay(utcDate('2026-06-07'))).toBe(false);
  });

  it('treats a supplied Polish public holiday as non-working', () => {
    const options: PayrollCalendarOptions = {
      publicHolidays: new Set<IsoDate>(['2026-06-04']),
    };

    expect(classifyPayrollDate(utcDate('2026-06-04'), options)).toBe(
      'non-working',
    );
  });

  it('allows an effective override to change either base classification', () => {
    const options: PayrollCalendarOptions = {
      publicHolidays: new Set<IsoDate>(['2026-06-04']),
      overrides: overrides([
        ['2026-06-04', 'working'],
        ['2026-06-06', 'working'],
        ['2026-06-08', 'non-working'],
      ]),
    };
    const calendar = createPayrollMonthCalendar('2026-06', options);

    expect(calendar.find((day) => day.isoDate === '2026-06-04')).toMatchObject({
      isPublicHoliday: true,
      override: 'working',
      isWorkingDay: true,
    });
    expect(calendar.find((day) => day.isoDate === '2026-06-06')).toMatchObject({
      isWeekend: true,
      override: 'working',
      isWorkingDay: true,
    });
    expect(calendar.find((day) => day.isoDate === '2026-06-08')).toMatchObject({
      override: 'non-working',
      isWorkingDay: false,
    });
  });
});

describe('month nominal hours', () => {
  it('calculates one common nominal from working days times eight hours', () => {
    expect(calculateMonthNominalHours('2026-06')).toBe(
      22 * STANDARD_WORKING_DAY_HOURS,
    );
  });

  it('applies public holidays and effective calendar overrides', () => {
    const holidayOptions: PayrollCalendarOptions = {
      publicHolidays: new Set<IsoDate>(['2026-06-04']),
    };
    expect(calculateMonthNominalHours('2026-06', holidayOptions)).toBe(
      21 * STANDARD_WORKING_DAY_HOURS,
    );

    expect(
      calculateMonthNominalHours('2026-06', {
        ...holidayOptions,
        overrides: overrides([
          ['2026-06-04', 'working'],
          ['2026-06-06', 'working'],
          ['2026-06-08', 'non-working'],
        ]),
      }),
    ).toBe(22 * STANDARD_WORKING_DAY_HOURS);
  });
});

describe('payroll-month participation', () => {
  const june = getPayrollMonthDateRange('2026-06');

  it('includes employment touching either month boundary', () => {
    expect(
      employeeParticipatesInPayrollMonth(employment('2026-06-30', null), june),
    ).toBe(true);
    expect(
      employeeParticipatesInPayrollMonth(
        employment('2026-05-01', '2026-06-01'),
        june,
      ),
    ).toBe(true);
  });

  it('excludes non-overlapping periods and a missing employment start', () => {
    expect(
      employeeParticipatesInPayrollMonth(employment('2026-07-01', null), june),
    ).toBe(false);
    expect(
      employeeParticipatesInPayrollMonth(
        employment('2026-01-01', '2026-05-31'),
        june,
      ),
    ).toBe(false);
    expect(employeeParticipatesInPayrollMonth(employment(null), june)).toBe(
      false,
    );
  });
});

describe('individual employee nominal hours', () => {
  it('equals month nominal for employment covering the full month', () => {
    const options: PayrollCalendarOptions = {
      publicHolidays: new Set<IsoDate>(['2026-06-04']),
    };

    expect(
      calculateEmployeeNominalHours(
        '2026-06',
        employment('2025-01-01', null),
        options,
      ),
    ).toBe(calculateMonthNominalHours('2026-06', options));
  });

  it('reduces nominal for employment starting or ending inside the month', () => {
    expect(
      calculateEmployeeNominalHours('2026-06', employment('2026-06-15', null)),
    ).toBe(12 * STANDARD_WORKING_DAY_HOURS);
    expect(
      calculateEmployeeNominalHours(
        '2026-06',
        employment('2026-01-01', '2026-06-12'),
      ),
    ).toBe(10 * STANDARD_WORKING_DAY_HOURS);
  });

  it('gives weekend employment boundaries zero nominal unless overridden', () => {
    const weekendStart = employment('2026-06-13', null);
    const weekendEnd = employment('2026-01-01', '2026-06-14');

    expect(calculateEmployeeNominalHours('2026-06', weekendStart)).toBe(
      12 * STANDARD_WORKING_DAY_HOURS,
    );
    expect(calculateEmployeeNominalHours('2026-06', weekendEnd)).toBe(
      10 * STANDARD_WORKING_DAY_HOURS,
    );
    expect(
      calculateEmployeeNominalHours('2026-06', weekendStart, {
        overrides: overrides([['2026-06-13', 'working']]),
      }),
    ).toBe(13 * STANDARD_WORKING_DAY_HOURS);
    expect(
      calculateEmployeeNominalHours('2026-06', weekendEnd, {
        overrides: overrides([['2026-06-14', 'working']]),
      }),
    ).toBe(11 * STANDARD_WORKING_DAY_HOURS);
  });

  it('gives a public-holiday employment boundary zero nominal unless overridden', () => {
    const holidayStart = employment('2026-06-15', null);
    const publicHolidays = new Set<IsoDate>(['2026-06-15']);

    expect(
      calculateEmployeeNominalHours('2026-06', holidayStart, {
        publicHolidays,
      }),
    ).toBe(11 * STANDARD_WORKING_DAY_HOURS);
    expect(
      calculateEmployeeNominalHours('2026-06', holidayStart, {
        publicHolidays,
        overrides: overrides([['2026-06-15', 'working']]),
      }),
    ).toBe(12 * STANDARD_WORKING_DAY_HOURS);
  });

  it('returns zero for missing start or a period outside the month', () => {
    expect(calculateEmployeeNominalHours('2026-06', employment(null))).toBe(0);
    expect(
      calculateEmployeeNominalHours('2026-06', employment('2026-07-01', null)),
    ).toBe(0);
  });
});

describe('employment boundaries and virtual defaults', () => {
  it('uses inclusive employment dates', () => {
    const period = employment('2026-06-10', '2026-06-20');

    expect(isDateWithinEmploymentPeriod('2026-06-09', period)).toBe(false);
    expect(isDateWithinEmploymentPeriod('2026-06-10', period)).toBe(true);
    expect(isDateWithinEmploymentPeriod('2026-06-20', period)).toBe(true);
    expect(isDateWithinEmploymentPeriod('2026-06-21', period)).toBe(false);
  });

  it('applies payroll virtual 8h only to an ungoverned working date inside employment', () => {
    const eligible = {
      isWorkingDay: true,
      isWithinEmployment: true,
      hasGoverningValue: false,
    };

    expect(virtualWorkedHoursDefaultApplies(eligible)).toBe(true);
    expect(getPayrollVirtualDefaultHours(eligible)).toBe(8);
    expect(
      getPayrollVirtualDefaultHours({
        ...eligible,
        hasGoverningValue: true,
      }),
    ).toBeNull();
    expect(
      getPayrollVirtualDefaultHours({
        ...eligible,
        isWorkingDay: false,
      }),
    ).toBeNull();
    expect(
      getPayrollVirtualDefaultHours({
        ...eligible,
        isWithinEmployment: false,
      }),
    ).toBeNull();
  });

  it('keeps future UI empty while preserving the closed-period calculation fallback', () => {
    const context = {
      isWorkingDay: true,
      isWithinEmployment: true,
      hasGoverningValue: false,
    };

    expect(getUiVirtualDefaultHours({ ...context, isFuture: true })).toBeNull();
    expect(getPayrollVirtualDefaultHours(context)).toBe(8);
    expect(
      getUiVirtualDefaultHours({
        ...context,
        isWorkingDay: false,
        isFuture: false,
      }),
    ).toBe(0);
  });
});
