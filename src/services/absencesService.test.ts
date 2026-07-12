import { describe, expect, it } from 'vitest';

import {
  monthIdFromAbsencePath,
  ownerMonthIdsForOverlappingDisplay,
} from './absencesService';

describe('absencesService', () => {
  it('extracts the owning month from an absence document path', () => {
    expect(monthIdFromAbsencePath('months/2026-06/absences/absence-1')).toBe(
      '2026-06',
    );
  });

  it('ignores paths outside monthly absence subcollections', () => {
    expect(monthIdFromAbsencePath('employees/employee-1')).toBeNull();
  });

  it('uses only existing owner months that can overlap the selected month', () => {
    expect(
      ownerMonthIdsForOverlappingDisplay(
        ['2026-05', '2026-06', '2026-07', '2026-08'],
        '2026-07',
      ),
    ).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('does not rely on future owner months for historical display', () => {
    expect(
      ownerMonthIdsForOverlappingDisplay(['2026-07', '2026-08'], '2026-06'),
    ).toEqual([]);
  });
});
