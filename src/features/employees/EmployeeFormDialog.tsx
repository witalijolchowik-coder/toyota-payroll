import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import {
  EmployeeServiceError,
  type EmployeeServiceErrorCode,
} from '../../services/employeesService';
import type {
  Department,
  Employee,
  EmployeeColorShift,
  EmployeeCreateInput,
} from '../../types/firestore';
import { deriveEmployeeMedicalStatus } from '../../utils/employees';
import {
  employeeInputFromForm,
  validateEmployeeInput,
} from './employeeValidation';
import type {
  EmployeeFormValues,
  EmployeeValidationCode,
  EmployeeValidationErrors,
} from './types';

interface EmployeeFormDialogProps {
  employee?: Employee;
  departments: Department[];
  onClose: () => void;
  onSubmit: (input: EmployeeCreateInput) => Promise<unknown>;
}

function dateInputValue(value: Date | null): string {
  return value?.toISOString().slice(0, 10) ?? '';
}

function initialValues(employee?: Employee): EmployeeFormValues {
  return {
    tetaNumber: employee?.tetaNumber ?? '',
    firstName: employee?.firstName ?? '',
    lastName: employee?.lastName ?? '',
    pesel: employee?.pesel ?? '',
    passportNumber: employee?.passportNumber ?? '',
    foreignDocumentNumber: employee?.foreignDocumentNumber ?? '',
    phoneNumber: employee?.phoneNumber ?? '',
    citizenship: employee?.citizenship ?? '',
    gender: employee?.gender ?? '',
    firstToyotaEmploymentDate: dateInputValue(
      employee?.firstToyotaEmploymentDate ?? null,
    ),
    medicalExaminationDate: dateInputValue(
      employee?.medicalExaminationDate ?? null,
    ),
    medicalValidUntil: dateInputValue(employee?.medicalValidUntil ?? null),
    medicalExaminationType: employee?.medicalExaminationType ?? '',
    departmentId: employee?.departmentId ?? '',
    shiftAssignment: employee?.shiftAssignment ?? '',
    assignmentEffectiveDate: dateInputValue(
      employee?.employmentStartDate ?? new Date(),
    ),
    employmentStartDate: dateInputValue(employee?.employmentStartDate ?? null),
    employmentEndDate: dateInputValue(employee?.employmentEndDate ?? null),
  };
}

export function EmployeeFormDialog({
  employee,
  departments,
  onClose,
  onSubmit,
}: EmployeeFormDialogProps) {
  const t = useTranslations();
  const [values, setValues] = useState(() => initialValues(employee));
  const [errors, setErrors] = useState<EmployeeValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assignmentChanged = Boolean(
    employee &&
    (employee.departmentId !== (values.departmentId || null) ||
      employee.shiftAssignment !== (values.shiftAssignment || null)),
  );

  const messageForError = (
    code: EmployeeValidationCode | undefined,
  ): string | undefined => {
    if (code === 'required') {
      return t.employees.form.required;
    }
    if (code === 'invalidDateRange') {
      return t.employees.form.invalidDateRange;
    }
    if (code === 'duplicateTeta') {
      return t.employees.errors.duplicateTeta;
    }
    if (code === 'invalidCitizenship') {
      return t.employees.form.invalidCitizenship;
    }
    if (code === 'invalidMedicalDateRange') {
      return t.employees.form.medical.invalidDateRange;
    }
    return undefined;
  };

  const handleChange =
    (field: keyof EmployeeFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setSubmitError(null);
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input = employeeInputFromForm(values, employee?.isActive ?? true);
    if (!assignmentChanged) {
      input.assignmentEffectiveDate = null;
    }
    const validationErrors = validateEmployeeInput(input);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
      onClose();
    } catch (error) {
      const code =
        error instanceof EmployeeServiceError ? error.code : undefined;
      if (code === 'duplicate-teta') {
        setErrors({ tetaNumber: 'duplicateTeta' });
      } else {
        setSubmitError(serviceErrorMessage(code, t));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewInput = employeeInputFromForm(
    values,
    employee?.isActive ?? true,
  );
  const departmentName =
    departments.find((department) => department.id === values.departmentId)
      ?.name ?? null;
  const medicalStatus = deriveEmployeeMedicalStatus(
    previewInput,
    departmentName,
  );

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>
          {employee ? t.employees.form.editTitle : t.employees.form.addTitle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t.employees.form.description}
            </Typography>

            {submitError ? <Alert severity="error">{submitError}</Alert> : null}

            <TextField
              autoFocus
              label={t.employees.form.teta}
              value={values.tetaNumber}
              onChange={handleChange('tetaNumber')}
              error={Boolean(errors.tetaNumber)}
              helperText={
                messageForError(errors.tetaNumber) ??
                t.employees.form.tetaReadinessHelper
              }
              slotProps={{ htmlInput: { autoComplete: 'off' } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                fullWidth
                label={t.employees.form.firstName}
                value={values.firstName}
                onChange={handleChange('firstName')}
                error={Boolean(errors.firstName)}
                helperText={messageForError(errors.firstName)}
                slotProps={{ htmlInput: { autoComplete: 'given-name' } }}
              />
              <TextField
                required
                fullWidth
                label={t.employees.form.lastName}
                value={values.lastName}
                onChange={handleChange('lastName')}
                error={Boolean(errors.lastName)}
                helperText={messageForError(errors.lastName)}
                slotProps={{ htmlInput: { autoComplete: 'family-name' } }}
              />
            </Stack>
            <Typography variant="subtitle2">
              {t.employees.form.sections.contact}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label={t.employees.form.phoneNumber}
                value={values.phoneNumber}
                onChange={handleChange('phoneNumber')}
                helperText={t.employees.form.phoneHelper}
                slotProps={{ htmlInput: { autoComplete: 'tel' } }}
              />
              <TextField
                fullWidth
                label={t.employees.form.citizenship}
                value={values.citizenship}
                onChange={handleChange('citizenship')}
                error={Boolean(errors.citizenship)}
                helperText={
                  messageForError(errors.citizenship) ??
                  t.employees.form.citizenshipHelper
                }
                slotProps={{ htmlInput: { maxLength: 2 } }}
              />
              <TextField
                select
                fullWidth
                label={t.employees.form.gender}
                value={values.gender}
                onChange={handleChange('gender')}
              >
                <MenuItem value="">{t.employees.form.genderUnknown}</MenuItem>
                <MenuItem value="K">
                  {t.employees.form.genderOptions.K}
                </MenuItem>
                <MenuItem value="M">
                  {t.employees.form.genderOptions.M}
                </MenuItem>
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label={t.employees.form.pesel}
                value={values.pesel}
                onChange={handleChange('pesel')}
                helperText={t.employees.form.identityOptional}
                slotProps={{ htmlInput: { autoComplete: 'off' } }}
              />
              <TextField
                fullWidth
                label={t.employees.form.passportNumber}
                value={values.passportNumber}
                onChange={handleChange('passportNumber')}
                helperText={t.employees.form.identityOptional}
                slotProps={{ htmlInput: { autoComplete: 'off' } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label={t.employees.form.department}
                value={values.departmentId}
                onChange={handleChange('departmentId')}
              >
                <MenuItem value="">
                  {t.organization.departments.unassigned}
                </MenuItem>
                {departments
                  .filter(
                    (department) =>
                      department.active ||
                      department.id === values.departmentId,
                  )
                  .map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                fullWidth
                label={t.employees.form.shiftAssignment}
                value={values.shiftAssignment}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    shiftAssignment: event.target.value as
                      EmployeeColorShift | '',
                  }))
                }
              >
                <MenuItem value="">{t.organization.shifts.unassigned}</MenuItem>
                <MenuItem value="RED">{t.organization.shifts.RED}</MenuItem>
                <MenuItem value="WHITE">{t.organization.shifts.WHITE}</MenuItem>
                <MenuItem value="BLUE">{t.organization.shifts.BLUE}</MenuItem>
              </TextField>
            </Stack>

            <Divider />
            <Stack spacing={1}>
              <Typography variant="subtitle2">
                {t.employees.form.medical.section}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  color={
                    medicalStatus.primary === 'valid'
                      ? 'success'
                      : medicalStatus.primary === 'expired'
                        ? 'error'
                        : 'warning'
                  }
                  label={t.employees.form.medical.status[medicalStatus.primary]}
                />
                {medicalStatus.issues.includes('department-mismatch') ? (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label={t.employees.form.medical.status.departmentMismatch}
                  />
                ) : null}
              </Stack>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="date"
                label={t.employees.form.medical.examinationDate}
                value={values.medicalExaminationDate}
                onChange={handleChange('medicalExaminationDate')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="date"
                label={t.employees.form.medical.validUntil}
                value={values.medicalValidUntil}
                onChange={handleChange('medicalValidUntil')}
                error={Boolean(errors.medicalValidUntil)}
                helperText={messageForError(errors.medicalValidUntil)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <TextField
              select
              label={t.employees.form.medical.type}
              value={values.medicalExaminationType}
              onChange={handleChange('medicalExaminationType')}
            >
              <MenuItem value="">
                {t.employees.form.medical.typeUnknown}
              </MenuItem>
              <MenuItem value="PRODUKCJA">
                {t.employees.form.medical.types.PRODUKCJA}
              </MenuItem>
              <MenuItem value="MAGAZYNIER">
                {t.employees.form.medical.types.MAGAZYNIER}
              </MenuItem>
              <MenuItem value="PRODUKCJA_HL_PU">
                {t.employees.form.medical.types.PRODUKCJA_HL_PU}
              </MenuItem>
            </TextField>
            {medicalStatus.issues.includes('department-mismatch') ? (
              <Alert severity="warning">
                {t.employees.form.medical.departmentMismatch}
              </Alert>
            ) : null}
            {assignmentChanged ? (
              <Alert severity="info">
                <Stack spacing={1.5}>
                  <Typography>
                    {t.employees.form.assignmentEffectivePrompt}
                  </Typography>
                  <TextField
                    required
                    fullWidth
                    type="date"
                    label={t.employees.form.assignmentEffectiveDate}
                    value={values.assignmentEffectiveDate}
                    onChange={handleChange('assignmentEffectiveDate')}
                    error={Boolean(errors.assignmentEffectiveDate)}
                    helperText={
                      messageForError(errors.assignmentEffectiveDate) ??
                      t.employees.form.assignmentEffectiveHelper
                    }
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              </Alert>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="date"
                label={t.employees.form.firstToyotaEmploymentDate}
                value={values.firstToyotaEmploymentDate}
                onChange={handleChange('firstToyotaEmploymentDate')}
                helperText={t.employees.form.firstToyotaEmploymentDateHelper}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                required
                fullWidth
                type="date"
                label={t.employees.form.employmentStartDate}
                value={values.employmentStartDate}
                onChange={handleChange('employmentStartDate')}
                error={Boolean(errors.employmentStartDate)}
                helperText={
                  messageForError(errors.employmentStartDate) ??
                  t.employees.form.employmentStartRequired
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="date"
                label={t.employees.form.employmentEndDate}
                value={values.employmentEndDate}
                onChange={handleChange('employmentEndDate')}
                error={Boolean(errors.employmentEndDate)}
                helperText={messageForError(errors.employmentEndDate)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t.employees.form.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
          >
            {employee ? t.employees.form.save : t.employees.form.create}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function serviceErrorMessage(
  code: EmployeeServiceErrorCode | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'firebase-unavailable') {
    return t.employees.errors.firebaseUnavailable;
  }
  if (code === 'authentication-required') {
    return t.employees.errors.authenticationRequired;
  }
  return t.employees.errors.saveFailed;
}
