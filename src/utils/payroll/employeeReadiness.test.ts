import { describe, expect, it } from 'vitest';

import {
  baseSalaryForFirstToyotaEmploymentDate,
  hasCurrentStatusConflict,
  isEmployeeActiveOnDate,
  preserveFirstToyotaEmploymentDate,
  requiredEmployeeDocumentIssues,
} from './employeeReadiness';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('employee readiness helpers', () => {
  it('derives current status from the employment dates', () => {
    const employee = {
      employmentStartDate: date('2026-01-10'),
      employmentEndDate: date('2026-07-10'),
    };
    expect(isEmployeeActiveOnDate(employee, date('2026-07-10'))).toBe(true);
    expect(isEmployeeActiveOnDate(employee, date('2026-07-11'))).toBe(false);
    expect(
      hasCurrentStatusConflict(
        { ...employee, isActive: true },
        date('2026-07-11'),
      ),
    ).toBe(true);
  });

  it('requires PESEL for PL and PESEL plus passport for foreign employees', () => {
    expect(
      requiredEmployeeDocumentIssues({ citizenship: 'PL', pesel: '123' }),
    ).toEqual([]);
    expect(
      requiredEmployeeDocumentIssues({ citizenship: 'UA', pesel: '123' }),
    ).toEqual(['missing-passport']);
    expect(
      requiredEmployeeDocumentIssues({ citizenship: null, pesel: null }),
    ).toEqual(['missing-citizenship', 'missing-pesel']);
  });

  it.each([
    ['2025-09-30', 5464],
    ['2025-10-01', 5279],
    ['2026-03-31', 5279],
    ['2026-04-01', 5160],
  ])('resolves salary boundary %s', (value, expected) => {
    expect(baseSalaryForFirstToyotaEmploymentDate(date(value))).toBe(expected);
  });

  it('does not replace the stable first Toyota employment date', () => {
    const original = date('2025-09-01');
    expect(
      preserveFirstToyotaEmploymentDate(original, date('2026-01-01')),
    ).toBe(original);
  });
});
