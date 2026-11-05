import { describe, it, expect } from 'vitest';
import { monthlyNominalForReport } from './monthlyNominalPresentation';

describe('October Headliner Yellow report-only monthly nominal', () => {
  it('changes only the 123h Headliner Yellow October reference', () => {
    const input = {
      monthId: '2026-10',
      scheduledHours: 123,
      context: { departmentId: 'headliner-bmw', brigade: 'YELLOW' },
    };
    expect(monthlyNominalForReport(input)).toBe(124);
    expect(input.scheduledHours).toBe(123);
    for (const monthId of ['2026-09', '2026-11'])
      expect(monthlyNominalForReport({ ...input, monthId })).toBe(123);
    for (const departmentId of [
      'metal-402b',
      'metal-936b',
      'szwalnia-toyota',
      'montaz-toyota',
      'pu-toyota',
    ])
      expect(
        monthlyNominalForReport({
          ...input,
          context: { ...input.context, departmentId },
        }),
      ).toBe(123);
    for (const brigade of ['BLUE', 'ORANGE', 'RED', 'WHITE', null])
      expect(
        monthlyNominalForReport({
          ...input,
          context: { departmentId: 'headliner-bmw', brigade },
        }),
      ).toBe(123);
    for (const scheduledHours of [124, 148, 176, null])
      expect(monthlyNominalForReport({ ...input, scheduledHours })).toBe(
        scheduledHours,
      );
    expect(monthlyNominalForReport({ ...input, context: null })).toBe(123);
  });
});
