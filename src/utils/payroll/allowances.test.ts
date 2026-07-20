import { describe, expect, it } from 'vitest';

import {
  calculateCompanyAccommodationCharge,
  calculateHousingDeposit,
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

describe('refundable housing deposit', () => {
  const episode = {
    episodeId: 'housing-episode-1',
    episodeStart: '2026-06-10',
    episodeEnd: '2026-08-20',
    employmentEnd: null,
    configuredAmount: 99,
  } as const;

  it('withholds once in the move-in month and remains held in between', () => {
    expect(
      calculateHousingDeposit({ monthId: '2026-06', ...episode }),
    ).toMatchObject({ held: 99, withheld: 99, automaticReturn: 0 });
    expect(
      calculateHousingDeposit({ monthId: '2026-07', ...episode }),
    ).toMatchObject({ held: 99, withheld: 0, automaticReturn: 0 });
  });

  it('returns once in the move-out month and supports a bounded override', () => {
    expect(
      calculateHousingDeposit({ monthId: '2026-08', ...episode }),
    ).toMatchObject({ automaticReturn: 99, finalReturn: 99 });
    expect(
      calculateHousingDeposit({
        monthId: '2026-08',
        ...episode,
        returnOverride: 60,
      }),
    ).toMatchObject({ automaticReturn: 99, finalReturn: 60 });
  });

  it('returns in the final employment month when employment ends first', () => {
    expect(
      calculateHousingDeposit({
        monthId: '2026-07',
        ...episode,
        employmentEnd: '2026-07-31',
      }),
    ).toMatchObject({ automaticReturn: 99, finalReturn: 99 });
  });

  it('is idempotent for the same episode input', () => {
    const first = calculateHousingDeposit({ monthId: '2026-06', ...episode });
    expect(calculateHousingDeposit({ monthId: '2026-06', ...episode })).toEqual(
      first,
    );
  });
});
