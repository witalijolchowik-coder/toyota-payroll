import { useMemo, useState, type FormEvent } from 'react';
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

import { useTranslations } from '../../hooks/useTranslations';
import { interpolate } from '../../i18n/pl';
import {
  DailyValueServiceError,
  type DailyValueServiceErrorCode,
} from '../../services/dailyValueService';
import type {
  ActualWorkingShift,
  Employee,
  WorkTimeCorrectionInput,
} from '../../types/firestore';
import {
  DEFAULT_SHIFT_INTERVALS,
  isValidClockTime,
  resolveDailyWorkTimeDeviation,
} from '../../utils/payroll';
import {
  decideDailyValueMutation,
  parseDailyHoursInput,
  type DailyHoursValidationError,
} from './dailyValueEntry';
import type { CalendarDay, SettlementCellValue } from './monthUtils';

interface DailyValueEditorDialogProps {
  employee: Employee;
  day: CalendarDay;
  value: SettlementCellValue;
  hasGoverningAbsence: boolean;
  onClose: () => void;
  onSave: (
    hours: number,
    note: string | null,
    workTimeCorrection: WorkTimeCorrectionInput | null,
  ) => Promise<void>;
  onClear: () => Promise<void>;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function DailyValueEditorDialog({
  employee,
  day,
  value,
  hasGoverningAbsence,
  onClose,
  onSave,
  onClear,
}: DailyValueEditorDialogProps) {
  const t = useTranslations();
  const [input, setInput] = useState(() => value.hours?.toString() ?? '');
  const [note, setNote] = useState(() => value.coordinatorNote ?? '');
  const [plannedShift, setPlannedShift] = useState<ActualWorkingShift>(
    () => value.workTimeCorrection?.plannedShift ?? 'FIRST',
  );
  const [actualStartTime, setActualStartTime] = useState(
    () => value.workTimeCorrection?.actualStartTime ?? '',
  );
  const [actualEndTime, setActualEndTime] = useState(
    () => value.workTimeCorrection?.actualEndTime ?? '',
  );
  const [validationError, setValidationError] =
    useState<DailyHoursValidationError | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const employeeName = `${employee.lastName} ${employee.firstName}`;
  const plannedInterval = DEFAULT_SHIFT_INTERVALS[plannedShift];
  const hasTimeCorrection =
    actualStartTime.trim().length > 0 || actualEndTime.trim().length > 0;
  const timeValidationError =
    hasTimeCorrection &&
    (!isValidClockTime(actualStartTime) || !isValidClockTime(actualEndTime));
  const workTimePreview = useMemo(() => {
    if (timeValidationError || !hasTimeCorrection) {
      return null;
    }
    return resolveDailyWorkTimeDeviation({
      planned: {
        shift: plannedShift,
        startTime: plannedInterval.startTime,
        endTime: plannedInterval.endTime,
      },
      actual: {
        startTime: actualStartTime,
        endTime: actualEndTime,
      },
      isWorkingDay: day.isWorkingDay,
      isSaturday: day.date.getUTCDay() === 6,
      isSunday: day.date.getUTCDay() === 0,
      isPublicHoliday: day.isHoliday,
    });
  }, [
    actualEndTime,
    actualStartTime,
    day.date,
    day.isHoliday,
    day.isWorkingDay,
    hasTimeCorrection,
    plannedInterval.endTime,
    plannedInterval.startTime,
    plannedShift,
    timeValidationError,
  ]);

  const clearValue = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onClear();
      onClose();
    } catch (error) {
      setSubmitError(serviceErrorMessage(error, 'clear', t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDailyHoursInput(input);
    if (parsed.kind === 'error') {
      setValidationError(parsed.code);
      return;
    }
    if (timeValidationError) {
      return;
    }

    const normalizedNote = note.trim() || null;
    const mutation = decideDailyValueMutation({
      parsed,
      currentKind: value.kind,
      currentHours: value.hours,
      currentNote: value.coordinatorNote,
      nextNote: normalizedNote,
      fallbackHours:
        hasGoverningAbsence &&
        value.kind !== 'imported' &&
        value.kind !== 'imported-override'
          ? null
          : value.fallbackHours,
    });

    if (mutation === 'none') {
      onClose();
      return;
    }

    if (mutation === 'clear') {
      await clearValue();
      return;
    }

    if (parsed.kind !== 'value') {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSave(
        parsed.hours,
        normalizedNote,
        hasTimeCorrection
          ? {
              plannedShift,
              plannedStartTime: plannedInterval.startTime,
              plannedEndTime: plannedInterval.endTime,
              actualStartTime,
              actualEndTime,
              classificationOverride: null,
            }
          : null,
      );
      onClose();
    } catch (error) {
      setSubmitError(serviceErrorMessage(error, 'save', t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{t.settlement.editor.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Typography color="text.secondary">
              {interpolate(t.settlement.editor.description, {
                employee: employeeName,
                date: dateFormatter.format(day.date),
              })}
            </Typography>
            {submitError ? <Alert severity="error">{submitError}</Alert> : null}
            <TextField
              autoFocus
              label={t.settlement.editor.hours}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setValidationError(null);
                setSubmitError(null);
              }}
              error={Boolean(validationError)}
              helperText={
                validationError
                  ? validationMessage(validationError, t)
                  : t.settlement.editor.helper
              }
              slotProps={{
                htmlInput: {
                  inputMode: 'decimal',
                  autoComplete: 'off',
                },
              }}
            />
            <TextField
              label={t.settlement.editor.note}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setSubmitError(null);
              }}
              multiline
              minRows={2}
              helperText={t.settlement.editor.noteHelper}
            />
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">
                {t.settlement.editor.workTime.title}
              </Typography>
              <TextField
                select
                label={t.settlement.editor.workTime.plannedShift}
                value={plannedShift}
                onChange={(event) =>
                  setPlannedShift(event.target.value as ActualWorkingShift)
                }
              >
                <MenuItem value="FIRST">
                  {t.organization.actualWorkingShifts.FIRST}
                </MenuItem>
                <MenuItem value="SECOND">
                  {t.organization.actualWorkingShifts.SECOND}
                </MenuItem>
                <MenuItem value="NIGHT">
                  {t.organization.actualWorkingShifts.NIGHT}
                </MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary">
                {interpolate(t.settlement.editor.workTime.plannedInterval, {
                  start: plannedInterval.startTime,
                  end: plannedInterval.endTime,
                })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  label={t.settlement.editor.workTime.actualStart}
                  value={actualStartTime}
                  onChange={(event) => setActualStartTime(event.target.value)}
                  placeholder="06:00"
                  error={Boolean(timeValidationError)}
                  helperText={
                    timeValidationError
                      ? t.settlement.editor.workTime.invalidTime
                      : t.settlement.editor.workTime.optional
                  }
                />
                <TextField
                  label={t.settlement.editor.workTime.actualEnd}
                  value={actualEndTime}
                  onChange={(event) => setActualEndTime(event.target.value)}
                  placeholder="14:00"
                  error={Boolean(timeValidationError)}
                  helperText={t.settlement.editor.workTime.optional}
                />
              </Stack>
              {workTimePreview ? (
                <Alert severity="info">
                  {interpolate(t.settlement.editor.workTime.preview, {
                    normal: formatHours(workTimePreview.normalWorkHours),
                    private: formatHours(workTimePreview.privateTimeHours),
                    overtime50: formatHours(workTimePreview.overtime50Hours),
                    overtime100: formatHours(workTimePreview.overtime100Hours),
                  })}
                </Alert>
              ) : null}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {value.kind === 'manual' || value.kind === 'imported-override' ? (
            <Button
              color="error"
              onClick={() => void clearValue()}
              disabled={isSubmitting}
              sx={{ mr: 'auto' }}
            >
              {t.settlement.editor.clear}
            </Button>
          ) : null}
          <Button onClick={onClose} disabled={isSubmitting}>
            {t.settlement.editor.cancel}
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
            {t.settlement.editor.save}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function validationMessage(
  code: DailyHoursValidationError,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'negative') {
    return t.settlement.editor.validation.negative;
  }
  if (code === 'above-maximum') {
    return t.settlement.editor.validation.aboveMaximum;
  }
  return t.settlement.editor.validation.notNumber;
}

function serviceErrorMessage(
  error: unknown,
  operation: 'save' | 'clear',
  t: ReturnType<typeof useTranslations>,
): string {
  const code = error instanceof DailyValueServiceError ? error.code : undefined;
  return serviceCodeMessage(code, operation, t);
}

function serviceCodeMessage(
  code: DailyValueServiceErrorCode | undefined,
  operation: 'save' | 'clear',
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'authentication-required') {
    return t.settlement.editor.errors.authentication;
  }
  if (code === 'firebase-unavailable') {
    return t.settlement.editor.errors.firebase;
  }
  return operation === 'save'
    ? t.settlement.editor.errors.save
    : t.settlement.editor.errors.clear;
}

function formatHours(hours: number): string {
  return hours.toLocaleString('pl-PL');
}
