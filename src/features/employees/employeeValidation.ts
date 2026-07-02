import type {
  Employee,
  EmployeeCreateInput,
  EmployeeId,
} from '../../types/firestore';
import type { EmployeeFormValues, EmployeeValidationErrors } from './types';

function dateFromInput(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export function normalizeTetaNumber(value: string): string {
  return value.trim().toLocaleUpperCase('pl-PL');
}

export function normalizeEmployeeInput(
  input: EmployeeCreateInput,
): EmployeeCreateInput {
  return {
    ...input,
    tetaNumber: normalizeTetaNumber(input.tetaNumber),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
  };
}

export function employeeInputFromForm(
  values: EmployeeFormValues,
  isActive = true,
): EmployeeCreateInput {
  return normalizeEmployeeInput({
    tetaNumber: values.tetaNumber,
    firstName: values.firstName,
    lastName: values.lastName,
    isActive,
    employmentStartDate: dateFromInput(values.employmentStartDate),
    employmentEndDate: dateFromInput(values.employmentEndDate),
  });
}

export function validateEmployeeInput(
  input: EmployeeCreateInput,
): EmployeeValidationErrors {
  const normalized = normalizeEmployeeInput(input);
  const errors: EmployeeValidationErrors = {};

  if (!normalized.tetaNumber) {
    errors.tetaNumber = 'required';
  }
  if (!normalized.firstName) {
    errors.firstName = 'required';
  }
  if (!normalized.lastName) {
    errors.lastName = 'required';
  }
  if (
    normalized.employmentStartDate &&
    normalized.employmentEndDate &&
    normalized.employmentEndDate < normalized.employmentStartDate
  ) {
    errors.employmentEndDate = 'invalidDateRange';
  }

  return errors;
}

export function isTetaNumberUniqueAmongActiveEmployees(
  employees: readonly Employee[],
  tetaNumber: string,
  ignoredEmployeeId?: EmployeeId,
): boolean {
  const normalizedCandidate = normalizeTetaNumber(tetaNumber);

  return !employees.some(
    (employee) =>
      employee.isActive &&
      employee.id !== ignoredEmployeeId &&
      normalizeTetaNumber(employee.tetaNumber) === normalizedCandidate,
  );
}
