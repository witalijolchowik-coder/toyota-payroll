import { describe, expect, it } from 'vitest';

import type { EmployeeSelectorOption } from './employeeSelector';
import {
  filterEmployeeSelectorOptions,
  formatEmployeeSelectorLabel,
  sortEmployeeSelectorOptions,
} from './employeeSelector';

const employees: EmployeeSelectorOption[] = [
  { id: '3', firstName: 'Łukasz', lastName: 'Żak', tetaNumber: 'WT-30' },
  { id: '2', firstName: 'Anna', lastName: 'Kowalska', tetaNumber: 'WT-20' },
  { id: '1', firstName: 'Adam', lastName: 'Kowalski', tetaNumber: 'WT-10' },
];

describe('employee selector helpers', () => {
  it('formats surname first and keeps TETA as a visual disambiguator', () => {
    expect(formatEmployeeSelectorLabel(employees[0])).toBe(
      'Żak Łukasz (WT-30)',
    );
  });

  it('sorts by surname, first name and TETA independently of input order', () => {
    expect(
      sortEmployeeSelectorOptions(employees).map((employee) => employee.id),
    ).toEqual(['2', '1', '3']);

    const duplicateNames = [
      { ...employees[1], id: 'later', tetaNumber: 'WT-200' },
      { ...employees[1], id: 'earlier', tetaNumber: 'WT-100' },
    ];
    expect(
      sortEmployeeSelectorOptions(duplicateNames).map(
        (employee) => employee.id,
      ),
    ).toEqual(['earlier', 'later']);
  });

  it('finds surname, first name, TETA and reversed multi-token queries', () => {
    expect(
      filterEmployeeSelectorOptions(employees, 'kow').map(({ id }) => id),
    ).toEqual(['2', '1']);
    expect(
      filterEmployeeSelectorOptions(employees, 'adam kow').map(({ id }) => id),
    ).toEqual(['1']);
    expect(
      filterEmployeeSelectorOptions(employees, 'kow anna').map(({ id }) => id),
    ).toEqual(['2']);
    expect(
      filterEmployeeSelectorOptions(employees, 'WT-30').map(({ id }) => id),
    ).toEqual(['3']);
  });

  it('ignores case, extra whitespace and Polish diacritics', () => {
    expect(
      filterEmployeeSelectorOptions(employees, '  ZAK   LUKASZ ').map(
        ({ id }) => id,
      ),
    ).toEqual(['3']);
  });

  it('prioritizes beginning matches before substring-only matches', () => {
    const matches = [
      ...employees,
      {
        id: '4',
        firstName: 'Joanna',
        lastName: 'Nowakowska',
        tetaNumber: 'WT-40',
      },
    ];
    expect(
      filterEmployeeSelectorOptions(matches, 'anna').map(({ id }) => id),
    ).toEqual(['2', '4']);
  });
});
