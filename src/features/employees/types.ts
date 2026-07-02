import type { EmployeeCreateInput } from '../../types/firestore';

export interface EmployeeFormValues {
  tetaNumber: string;
  firstName: string;
  lastName: string;
  employmentStartDate: string;
  employmentEndDate: string;
}

export type EmployeeFieldName =
  'tetaNumber' | 'firstName' | 'lastName' | 'employmentEndDate';

export type EmployeeValidationCode =
  'required' | 'invalidDateRange' | 'duplicateTeta';

export type EmployeeValidationErrors = Partial<
  Record<EmployeeFieldName, EmployeeValidationCode>
>;

export interface EmployeeFormSubmission {
  input: EmployeeCreateInput;
}

export type EmployeeStatusFilter = 'all' | 'active' | 'inactive';
