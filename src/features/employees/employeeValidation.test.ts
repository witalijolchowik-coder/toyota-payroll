import type { Employee, EmployeeCreateInput } from '../../types/firestore';
import {
  isTetaNumberUniqueAmongActiveEmployees,
  normalizeEmployeeInput,
  validateEmployeeInput,
} from './employeeValidation';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test-user',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test-user',
};

function employee(id: string, tetaNumber: string, isActive: boolean): Employee {
  return {
    id,
    tetaNumber,
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive,
    employmentStartDate: null,
    employmentEndDate: null,
    ...metadata,
  };
}

function validInput(
  overrides: Partial<EmployeeCreateInput> = {},
): EmployeeCreateInput {
  return {
    tetaNumber: 'TETA-1001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive: true,
    employmentStartDate: null,
    employmentEndDate: null,
    ...overrides,
  };
}

describe('employee validation', () => {
  it('requires TETA number, first name, and last name after trimming', () => {
    expect(
      validateEmployeeInput(
        validInput({
          tetaNumber: ' ',
          firstName: '',
          lastName: '  ',
        }),
      ),
    ).toEqual({
      tetaNumber: 'required',
      firstName: 'required',
      lastName: 'required',
    });
  });

  it('rejects an employment end date before the start date', () => {
    expect(
      validateEmployeeInput(
        validInput({
          employmentStartDate: new Date('2026-07-10T00:00:00.000Z'),
          employmentEndDate: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ),
    ).toEqual({ employmentEndDate: 'invalidDateRange' });
  });

  it('normalizes TETA and employee names before persistence', () => {
    expect(
      normalizeEmployeeInput(
        validInput({
          tetaNumber: ' teta-1001 ',
          firstName: ' Jan ',
          lastName: ' Kowalski ',
        }),
      ),
    ).toMatchObject({
      tetaNumber: 'TETA-1001',
      firstName: 'Jan',
      lastName: 'Kowalski',
    });
  });
});

describe('active employee TETA uniqueness', () => {
  const employees = [
    employee('employee-1', 'TETA-1001', true),
    employee('employee-2', 'TETA-2002', false),
  ];

  it('treats active TETA numbers as case-insensitive duplicates', () => {
    expect(
      isTetaNumberUniqueAmongActiveEmployees(employees, ' teta-1001 '),
    ).toBe(false);
  });

  it('allows a TETA number held only by an inactive employee', () => {
    expect(isTetaNumberUniqueAmongActiveEmployees(employees, 'TETA-2002')).toBe(
      true,
    );
  });

  it('ignores the edited employee when checking its unchanged TETA number', () => {
    expect(
      isTetaNumberUniqueAmongActiveEmployees(
        employees,
        'TETA-1001',
        'employee-1',
      ),
    ).toBe(true);
  });
});
