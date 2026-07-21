import type {
  Employee,
  EmployeeCreateInput,
  EmployeeId,
} from '../../types/firestore';
import { isEmployeeColorShift } from '../../utils/organization';
import {
  isValidCitizenship,
  normalizePhoneNumber,
} from '../../utils/employees';
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
    phoneNumber: input.phoneNumber
      ? normalizePhoneNumber(input.phoneNumber) || null
      : null,
    citizenship: input.citizenship?.trim().toUpperCase() || null,
    gender: input.gender ?? null,
    firstToyotaEmploymentDate: input.firstToyotaEmploymentDate ?? null,
    medicalExaminationDate: input.medicalExaminationDate ?? null,
    medicalValidUntil: input.medicalValidUntil ?? null,
    medicalExaminationType: input.medicalExaminationType ?? null,
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
    phoneNumber: values.phoneNumber,
    citizenship: values.citizenship || null,
    gender: values.gender || null,
    firstToyotaEmploymentDate: dateFromInput(values.firstToyotaEmploymentDate),
    medicalExaminationDate: dateFromInput(values.medicalExaminationDate),
    medicalValidUntil: dateFromInput(values.medicalValidUntil),
    medicalExaminationType: values.medicalExaminationType || null,
    isActive,
    departmentId: values.departmentId || null,
    shiftAssignment: isEmployeeColorShift(values.shiftAssignment)
      ? values.shiftAssignment
      : null,
    initialContract: values.initialContractStartDate
      ? {
          startDate: dateFromInput(values.initialContractStartDate)!,
          endDate: dateFromInput(values.initialContractEndDate),
        }
      : null,
    assignmentEffectiveDate: values.assignmentEffectiveDate || null,
  });
}

export function validateEmployeeInput(
  input: EmployeeCreateInput,
  options: { requireInitialContract?: boolean } = {},
): EmployeeValidationErrors {
  const normalized = normalizeEmployeeInput(input);
  const errors: EmployeeValidationErrors = {};

  if (!normalized.firstName) {
    errors.firstName = 'required';
  }
  if (!normalized.lastName) {
    errors.lastName = 'required';
  }
  if ((options.requireInitialContract ?? true) && !normalized.initialContract) {
    errors.initialContractStartDate = 'required';
  }
  if (
    normalized.assignmentEffectiveDate &&
    !isValidDateInput(normalized.assignmentEffectiveDate)
  ) {
    errors.assignmentEffectiveDate = 'invalidDateRange';
  }
  if (
    normalized.initialContract?.endDate &&
    normalized.initialContract.endDate < normalized.initialContract.startDate
  ) {
    errors.initialContractEndDate = 'invalidDateRange';
  }
  if (normalized.citizenship && !isValidCitizenship(normalized.citizenship)) {
    errors.citizenship = 'invalidCitizenship';
  }
  if (
    normalized.medicalExaminationDate &&
    normalized.medicalValidUntil &&
    normalized.medicalValidUntil < normalized.medicalExaminationDate
  ) {
    errors.medicalValidUntil = 'invalidMedicalDateRange';
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
