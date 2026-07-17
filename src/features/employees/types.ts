import type {
  DepartmentId,
  EmployeeColorShift,
  EmployeeCreateInput,
  EmployeeGender,
  MedicalExaminationType,
} from '../../types/firestore';

export interface EmployeeFormValues {
  tetaNumber: string;
  firstName: string;
  lastName: string;
  pesel: string;
  passportNumber: string;
  foreignDocumentNumber: string;
  phoneNumber: string;
  citizenship: string;
  gender: '' | EmployeeGender;
  firstToyotaEmploymentDate: string;
  medicalExaminationDate: string;
  medicalValidUntil: string;
  medicalExaminationType: '' | MedicalExaminationType;
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
  | 'phoneNumber'
  | 'citizenship'
  | 'gender'
  | 'firstToyotaEmploymentDate'
  | 'medicalExaminationDate'
  | 'medicalValidUntil'
  | 'medicalExaminationType'
  | 'assignmentEffectiveDate'
  | 'employmentStartDate'
  | 'employmentEndDate';

export type EmployeeValidationCode =
  | 'required'
  | 'invalidDateRange'
  | 'duplicateTeta'
  | 'invalidCitizenship'
  | 'invalidMedicalDateRange';

export type EmployeeValidationErrors = Partial<
  Record<EmployeeFieldName, EmployeeValidationCode>
>;

export interface EmployeeFormSubmission {
  input: EmployeeCreateInput;
}

export type EmployeeStatusFilter = 'active' | 'archive';
