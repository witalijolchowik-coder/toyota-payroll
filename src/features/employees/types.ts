import type {
  DepartmentId,
  EmployeeColorShift,
  EmployeeCreateInput,
} from '../../types/firestore';

export interface EmployeeFormValues {
  tetaNumber: string;
  firstName: string;
  lastName: string;
  pesel: string;
  passportNumber: string;
  foreignDocumentNumber: string;
  citizenship: '' | 'PL' | 'UA' | 'OTHER';
  firstToyotaEmploymentDate: string;
  departmentId: DepartmentId | '';
  shiftAssignment: EmployeeColorShift | '';
  assignmentEffectiveDate: string;
  employmentStartDate: string;
  employmentEndDate: string;
}

export type EmployeeFieldName =
  | 'tetaNumber'
  | 'firstName'
  | 'lastName'
  | 'pesel'
  | 'passportNumber'
  | 'foreignDocumentNumber'
  | 'citizenship'
  | 'firstToyotaEmploymentDate'
  | 'assignmentEffectiveDate'
  | 'employmentStartDate'
  | 'employmentEndDate';

export type EmployeeValidationCode =
  'required' | 'invalidDateRange' | 'duplicateTeta';

export type EmployeeValidationErrors = Partial<
  Record<EmployeeFieldName, EmployeeValidationCode>
>;

export interface EmployeeFormSubmission {
  input: EmployeeCreateInput;
}

export type EmployeeStatusFilter = 'all' | 'active' | 'inactive';
