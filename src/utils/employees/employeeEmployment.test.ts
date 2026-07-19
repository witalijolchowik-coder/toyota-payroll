import { describe, expect, it } from 'vitest';

import {
  calculateFirstEmploymentLimit,
  formatPolishDate,
  resolveCurrentEmploymentPeriod,
} from './employeeEmployment';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('employee employment helpers', () => {
  it.each([
    ['2025-05-09', '2026-11-09'],
    ['2025-08-31', '2027-02-28'],
    ['2024-02-29', '2025-08-29'],
    ['2023-08-31', '2025-02-28'],
  ])('adds 18 calendar months to %s', (source, expected) => {
    expect(
      calculateFirstEmploymentLimit(date(source))?.toISOString().slice(0, 10),
    ).toBe(expected);
  });

  it('returns no limit for a missing first employment date', () => {
    expect(calculateFirstEmploymentLimit(null)).toBeNull();
    expect(calculateFirstEmploymentLimit(undefined)).toBeNull();
  });

  it('does not mutate the source date', () => {
    const source = date('2025-08-31');
    const before = source.getTime();

    calculateFirstEmploymentLimit(source);

    expect(source.getTime()).toBe(before);
  });

  it('resolves only a period with a current contract start', () => {
    expect(
      resolveCurrentEmploymentPeriod({
        employmentStartDate: date('2026-06-01'),
        employmentEndDate: date('2026-08-31'),
      }),
    ).toEqual({
      startDate: date('2026-06-01'),
      endDate: date('2026-08-31'),
    });
    expect(
      resolveCurrentEmploymentPeriod({
        employmentStartDate: null,
        employmentEndDate: date('2026-08-31'),
      }),
    ).toBeNull();
  });

  it('formats dates deterministically in Polish order', () => {
    expect(formatPolishDate(date('2026-07-09'))).toBe('09.07.2026');
  });
});
