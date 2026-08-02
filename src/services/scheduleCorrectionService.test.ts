import { describe, expect, it } from 'vitest';

import {
  isDailyShiftCorrectionUnchanged,
  scheduleCorrectionKindForShift,
} from './scheduleCorrectionService';

describe('scheduleCorrectionKindForShift', () => {
  it.each([
    ['FIRST', 'FIRST_SHIFT'],
    ['SECOND', 'SECOND_SHIFT'],
    ['NIGHT', 'NIGHT_SHIFT'],
  ] as const)('maps %s to %s', (shift, expected) => {
    expect(scheduleCorrectionKindForShift(shift)).toBe(expected);
  });
});

describe('isDailyShiftCorrectionUnchanged', () => {
  const input = {
    plannedShift: 'NIGHT' as const,
    plannedHours: 8,
    note: 'Zmiana indywidualna',
  };
  const stored = {
    status: 'ACTIVE' as const,
    kind: 'NIGHT_SHIFT' as const,
    planned_shift: 'NIGHT' as const,
    planned_hours: 8,
    note: 'Zmiana indywidualna',
  };

  it('recognizes an identical active correction so a repeated save is a no-op', () => {
    expect(isDailyShiftCorrectionUnchanged(stored, input)).toBe(true);
  });

  it('requires a write when the shift changes or a cancelled correction is restored', () => {
    expect(
      isDailyShiftCorrectionUnchanged(stored, {
        ...input,
        plannedShift: 'FIRST',
      }),
    ).toBe(false);
    expect(
      isDailyShiftCorrectionUnchanged(
        { ...stored, status: 'CANCELLED' },
        input,
      ),
    ).toBe(false);
  });
});
