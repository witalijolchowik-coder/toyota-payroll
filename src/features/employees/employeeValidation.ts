import type {
  Employee,
  EmployeeCreateInput,
  EmployeeId,
} from '../../types/firestore';
import { isEmployeeColorShift } from '../../utils/organization';
import type { EmployeeFormValues, EmployeeValidationErrors } from './types';

function dateFromInput(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function isValidDateInput(value: string): boolean {
  const parsed = dateFromInput(value);
  return Boolean(parsed && !Number.isNaN(parsed.getTime()));
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
    pesel: input.pesel?.trim() || null,
    passportNumber: input.passportNumber?.trim() || null,
    foreignDocumentNumber: input.foreignDocumentNumber?.trim() || null,
    citizenship: input.citizenship ?? null,
    firstToyotaEmploymentDate: input.firstToyotaEmploymentDate ?? null,
    departmentId: input.departmentId?.trim() || null,
    shiftAssignment: input.shiftAssignment ?? null,
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
    pesel: values.pesel,
    passportNumber: values.passportNumber,
    foreignDocumentNumber: values.foreignDocumentNumber,
    citizenship: values.citizenship || null,
    firstToyotaEmploymentDate: dateFromInput(values.firstToyotaEmploymentDate),
    isActive,
    departmentId: values.departmentId || null,
    shiftAssignment: isEmployeeColorShift(values.shiftAssignment)
      ? values.shiftAssignment
      : null,
    employmentStartDate: dateFromInput(values.employmentStartDate),
    employmentEndDate: dateFromInput(values.employmentEndDate),
    assignmentEffectiveDate: values.assignmentEffectiveDate || null,
  });
}

export function validateEmployeeInput(
  input: EmployeeCreateInput,
): EmployeeValidationErrors {
  const normalized = normalizeEmployeeInput(input);
  const errors: EmployeeValidationErrors = {};

  if (!normalized.firstName) {
    errors.firstName = 'required';
  }
  if (!normalized.lastName) {
    errors.lastName = 'required';
  }
  if (!normalized.employmentStartDate) {
    errors.employmentStartDate = 'required';
  }
  if (
    normalized.assignmentEffectiveDate &&
    !isValidDateInput(normalized.assignmentEffectiveDate)
  ) {
    errors.assignmentEffectiveDate = 'invalidDateRange';
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

  if (!normalizedCandidate) {
    return true;
  }

  return !employees.some(
    (employee) =>
      employee.isActive &&
      employee.id !== ignoredEmployeeId &&
      normalizeTetaNumber(employee.tetaNumber) === normalizedCandidate,
  );
}
