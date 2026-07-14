import { describe, expect, it } from 'vitest';

import type { Department, Employee } from '../../types/firestore';
import {
  employeeMatchesListMode,
  nextEmployeeSort,
  sortEmployees,
} from './employeeTableModel';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const employee = (overrides: Partial<Employee>): Employee =>
  ({
    id: 'e',
    tetaNumber: 'WT-10',
    firstName: 'Jan',
    lastName: 'Nowak',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: date('2026-01-01'),
    employmentEndDate: null,
    createdAt: date('2026-01-01'),
    createdBy: 'u',
    updatedAt: date('2026-01-01'),
    updatedBy: 'u',
    ...overrides,
  }) as Employee;

const department = (id: string, name: string): Department =>
  ({ id, name }) as Department;

describe('employee table model', () => {
  it('separates active contracts from the final archive', () => {
    expect(
      employeeMatchesListMode(employee({}), 'active', date('2026-07-14')),
    ).toBe(true);
    expect(
      employeeMatchesListMode(
        employee({ employmentEndDate: date('2026-07-13') }),
        'archive',
        date('2026-07-14'),
      ),
    ).toBe(true);
    expect(
      employeeMatchesListMode(
        employee({ employmentEndDate: date('2026-07-14') }),
        'archive',
        date('2026-07-14'),
      ),
    ).toBe(false);
  });

  it('sorts employees by surname and then first name', () => {
    const result = sortEmployees(
      [
        employee({ id: '2', firstName: 'Zenon', lastName: 'Adamski' }),
        employee({ id: '1', firstName: 'Adam', lastName: 'Adamski' }),
      ],
      [],
      { key: 'employee', direction: 'asc' },
    );
    expect(result.map((item) => item.firstName)).toEqual(['Adam', 'Zenon']);
  });

  it('uses canonical department order and department-first shift sorting', () => {
    const departments = [department('metal', 'Metal'), department('pu', 'PU')];
    const result = sortEmployees(
      [
        employee({ id: '1', departmentId: 'pu', shiftAssignment: 'RED' }),
        employee({ id: '2', departmentId: 'metal', shiftAssignment: 'WHITE' }),
        employee({ id: '3', departmentId: 'metal', shiftAssignment: 'RED' }),
      ],
      departments,
      { key: 'shift', direction: 'asc' },
    );
    expect(result.map((item) => item.id)).toEqual(['3', '2', '1']);
    const descending = sortEmployees(result, departments, {
      key: 'shift',
      direction: 'desc',
    });
    expect(descending.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('toggles direction without changing the selected filter state', () => {
    expect(
      nextEmployeeSort({ key: 'shift', direction: 'asc' }, 'shift'),
    ).toEqual({
      key: 'shift',
      direction: 'desc',
    });
  });
});
