import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { Employee } from '../../types/firestore';
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
  onSave: (hours: number, note: string | null) => Promise<void>;
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
  const [validationError, setValidationError] =
    useState<DailyHoursValidationError | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const employeeName = `${employee.lastName} ${employee.firstName}`;

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
      await onSave(parsed.hours, normalizedNote);
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
