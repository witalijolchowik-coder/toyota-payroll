import { describe, expect, it } from 'vitest';

import { allocateMonthlyOvertime } from './overtimeAllocation';

describe('monthly overtime allocation', () => {
  it('covers shortages before NI time off and never uses an hour twice', () => {
    const result = allocateMonthlyOvertime({
      pools: [
        { date: '2026-07-03', rate: 50, hours: 6 },
        { date: '2026-07-05', rate: 100, hours: 4 },
      ],
      shortageDemands: [
        {
          id: 'shortage',
          date: '2026-07-04',
          kind: 'PRIVATE_TIME',
          hours: 5,
        },
      ],
      timeOffDemands: [
        {
          id: 'time-off',
          date: '2026-07-10',
          kind: 'NI_TIME_OFF',
          hours: 8,
        },
      ],
    });

    expect(result.demands).toEqual([
      expect.objectContaining({ id: 'shortage', allocatedHours: 5 }),
      expect.objectContaining({
        id: 'time-off',
        allocatedHours: 5,
        unresolvedHours: 3,
      }),
    ]);
    expect(
      result.allocations.reduce(
        (total, allocation) => total + allocation.hours,
        0,
      ),
    ).toBe(10);
    expect(result.remainingPools.every((pool) => pool.hours === 0)).toBe(true);
  });

  it('does not allocate future overtime to a new NI time-off record', () => {
    const result = allocateMonthlyOvertime({
      pools: [{ date: '2026-07-20', rate: 100, hours: 8 }],
      shortageDemands: [],
      timeOffDemands: [
        {
          id: 'time-off',
          date: '2026-07-10',
          kind: 'NI_TIME_OFF',
          hours: 8,
        },
      ],
    });

    expect(result.allocations).toEqual([]);
    expect(result.demands[0]).toMatchObject({
      allocatedHours: 0,
      unresolvedHours: 8,
    });
  });
});
