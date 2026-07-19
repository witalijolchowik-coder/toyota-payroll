import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { ExactDateField } from '../../components/forms/ExactDateTimeField';
import { useTranslations } from '../../hooks/useTranslations';
import {
  AbsenceServiceError,
  type AbsenceServiceErrorCode,
} from '../../services/absencesService';
import type {
  Absence,
  AbsenceCreateInput,
  Employee,
} from '../../types/firestore';
import {
  ABSENCE_CODES,
  normalizeAbsenceCode,
  validateAbsenceInput,
  type AbsenceValidationCode,
  type AbsenceValidationErrors,
} from '../../utils/absences';

interface AbsenceFormDialogProps {
  absence?: Absence;
  employees: Employee[];
  defaultStartDate: string;
  onClose: () => void;
  onSubmit: (input: AbsenceCreateInput) => Promise<unknown>;
}

interface FormValues {
  employeeId: string;
  absenceCode: string;
  startDate: string;
  endDate: string;
  linkedWorkDate: string;
  note: string;
}

export function AbsenceFormDialog({
  absence,
  employees,
  defaultStartDate,
  onClose,
  onSubmit,
}: AbsenceFormDialogProps) {
  const t = useTranslations();
  const [values, setValues] = useState<FormValues>({
    employeeId: absence?.employeeId ?? '',
    absenceCode: absence?.absenceCode ?? 'L4',
    startDate: absence?.startDate ?? defaultStartDate,
    endDate: absence?.endDate ?? defaultStartDate,
    linkedWorkDate: absence?.linkedWorkDate ?? '',
    note: absence?.note ?? '',
  });
  const [errors, setErrors] = useState<AbsenceValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange =
    (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setSubmitError(null);
    };

  const handleDateChange =
    (field: 'startDate' | 'endDate' | 'linkedWorkDate') => (value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setSubmitError(null);
    };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateAbsenceInput(values, absence?.monthId);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    const employee = employees.find(
      (candidate) => candidate.id === values.employeeId,
    );
    if (!employee) {
      setErrors({ employeeId: 'required' });
      return;
    }

    const input: AbsenceCreateInput = {
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      absenceCode: normalizeAbsenceCode(values.absenceCode),
      startDate: values.startDate,
      endDate: values.endDate,
      hoursPerDay: null,
      linkedWorkDate:
        normalizeAbsenceCode(values.absenceCode) === 'WZN' &&
        values.linkedWorkDate
          ? values.linkedWorkDate
          : null,
      note: values.note.trim() || null,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (error) {
      setSubmitError(
        serviceErrorMessage(
          error instanceof AbsenceServiceError ? error.code : undefined,
          t,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageFor = (code?: AbsenceValidationCode) => {
    if (!code) return undefined;
    return t.absences.form.validation[code];
  };

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>
          {absence ? t.absences.form.editTitle : t.absences.form.addTitle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              {t.absences.form.description}
            </Typography>
            {submitError ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              select
              required
              disabled={Boolean(absence)}
              label={t.absences.form.employee}
              value={values.employeeId}
              onChange={handleChange('employeeId')}
              error={Boolean(errors.employeeId)}
              helperText={messageFor(errors.employeeId)}
            >
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.tetaNumber} — {employee.lastName}{' '}
                  {employee.firstName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              required
              label={t.absences.form.type}
              value={values.absenceCode}
              onChange={handleChange('absenceCode')}
              error={Boolean(errors.absenceCode)}
              helperText={messageFor(errors.absenceCode)}
            >
              {ABSENCE_CODES.map((code) => (
                <MenuItem key={code} value={code}>
                  {code === 'UZ' ? t.absences.types.UZ : code}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <ExactDateField
                required
                fullWidth
                label={t.absences.form.startDate}
                value={values.startDate}
                onValueChange={handleDateChange('startDate')}
                error={Boolean(errors.startDate)}
                helperText={messageFor(errors.startDate)}
                invalidMessage={t.input.exactDateInvalid}
                pickerLabel={t.input.openDatePicker}
              />
              <ExactDateField
                required
                fullWidth
                label={t.absences.form.endDate}
                value={values.endDate}
                onValueChange={handleDateChange('endDate')}
                error={Boolean(errors.endDate)}
                helperText={messageFor(errors.endDate)}
                invalidMessage={t.input.exactDateInvalid}
                pickerLabel={t.input.openDatePicker}
              />
            </Stack>
            {normalizeAbsenceCode(values.absenceCode) === 'WZN' ? (
              <ExactDateField
                label={t.absences.form.linkedWorkDate}
                value={values.linkedWorkDate}
                onValueChange={handleDateChange('linkedWorkDate')}
                helperText={t.absences.form.linkedWorkDateHelper}
                invalidMessage={t.input.exactDateInvalid}
                pickerLabel={t.input.openDatePicker}
              />
            ) : null}
            <TextField
              multiline
              minRows={2}
              label={t.absences.form.note}
              value={values.note}
              onChange={handleChange('note')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t.absences.form.cancel}
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
            {absence ? t.absences.form.save : t.absences.form.create}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function serviceErrorMessage(
  code: AbsenceServiceErrorCode | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'l4-overlap') return t.absences.errors.l4Overlap;
  if (code === 'ownership-month-change')
    return t.absences.errors.ownershipMonthChange;
  if (code === 'month-unavailable') return t.absences.errors.monthUnavailable;
  if (code === 'month-settled') return t.absences.errors.monthSettled;
  if (code === 'authentication-required')
    return t.absences.errors.authenticationRequired;
  if (code === 'firebase-unavailable')
    return t.absences.errors.firebaseUnavailable;
  return t.absences.errors.saveFailed;
}
