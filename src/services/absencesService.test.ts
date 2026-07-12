import { describe, expect, it } from 'vitest';

import { monthIdFromAbsencePath } from './absencesService';

describe('absencesService', () => {
  it('extracts the owning month from an absence document path', () => {
    expect(monthIdFromAbsencePath('months/2026-06/absences/absence-1')).toBe(
      '2026-06',
    );
  });

  it('ignores paths outside monthly absence subcollections', () => {
    expect(monthIdFromAbsencePath('employees/employee-1')).toBeNull();
  });
});
