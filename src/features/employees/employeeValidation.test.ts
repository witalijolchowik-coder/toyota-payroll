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
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-07-01T00:00:00.000Z'),
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
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-07-01T00:00:00.000Z'),
    employmentEndDate: null,
    ...overrides,
  };
}

describe('employee validation', () => {
  it('allows preparation without TETA but requires name and employment start', () => {
    expect(
      validateEmployeeInput(
        validInput({
          tetaNumber: ' ',
          firstName: '',
          lastName: '  ',
          employmentStartDate: null,
        }),
      ),
    ).toEqual({
      firstName: 'required',
      lastName: 'required',
      employmentStartDate: 'required',
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
          pesel: ' 87010409887 ',
          passportNumber: ' ',
          foreignDocumentNumber: ' FU419350 ',
        }),
      ),
    ).toMatchObject({
      tetaNumber: 'TETA-1001',
      firstName: 'Jan',
      lastName: 'Kowalski',
      pesel: '87010409887',
      passportNumber: null,
      foreignDocumentNumber: 'FU419350',
      departmentId: null,
      shiftAssignment: null,
    });
  });

  it('normalizes department assignment fields before persistence', () => {
    expect(
      normalizeEmployeeInput(
        validInput({
          departmentId: ' metal ',
          shiftAssignment: 'RED',
        }),
      ),
    ).toMatchObject({
      departmentId: 'metal',
      shiftAssignment: 'RED',
    });
  });

  it('normalizes phone and citizenship without losing prefixes or zeroes', () => {
    expect(
      normalizeEmployeeInput(
        validInput({
          phoneNumber: '  +380  050 123 4567 ',
          citizenship: 'ua',
        }),
      ),
    ).toMatchObject({
      phoneNumber: '+380 050 123 4567',
      citizenship: 'UA',
    });
  });

  it('rejects unknown citizenship and invalid medical date range', () => {
    expect(
      validateEmployeeInput(
        validInput({
          citizenship: 'XX',
          medicalExaminationDate: new Date('2026-07-20T00:00:00.000Z'),
          medicalValidUntil: new Date('2026-07-19T00:00:00.000Z'),
        }),
      ),
    ).toMatchObject({
      citizenship: 'invalidCitizenship',
      medicalValidUntil: 'invalidMedicalDateRange',
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
