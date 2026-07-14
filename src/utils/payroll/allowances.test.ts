import { describe, expect, it } from 'vitest';

import {
  calculateCompanyAccommodationCharge,
  calculateLaundryAllowance,
  calculateTransportAllowance,
  isQualifyingAllowancePresence,
} from './allowances';

describe('allowance helpers', () => {
  it('calculates attendance-proportional values and respects the caps', () => {
    expect(calculateLaundryAllowance(10, 20)).toBe(20);
    expect(calculateLaundryAllowance(25, 20)).toBe(40);
    expect(calculateTransportAllowance(10, 20)).toBe(137.5);
  });

  it('counts work, BHP, training and delegation as qualifying presence', () => {
    expect(
      ['WORK', 'BHP', 'TRAINING', 'DELEGATION'].every((code) =>
        isQualifyingAllowancePresence(code as 'WORK'),
      ),
    ).toBe(true);
    expect(isQualifyingAllowancePresence('L4')).toBe(false);
    expect(isQualifyingAllowancePresence('NN')).toBe(false);
  });

  it('prorates company accommodation by employment and occupancy overlap', () => {
    expect(
      calculateCompanyAccommodationCharge({
        monthStart: '2026-07-01',
        monthEnd: '2026-07-31',
        employmentStart: '2026-07-05',
        moveInDate: '2026-07-10',
        moveOutDate: '2026-07-21',
        mediaMonthly: 150,
        accommodationMonthly: 500,
      }),
    ).toEqual({
      chargedDays: 11,
      media: 53.23,
      accommodation: 177.42,
      total: 230.65,
    });
  });
});
