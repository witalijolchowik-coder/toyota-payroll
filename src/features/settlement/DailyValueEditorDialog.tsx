import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Tab,
  Tabs,
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
  Absence,
  ActualWorkingShift,
  Employee,
  WorkTimeCorrectionInput,
} from '../../types/firestore';
import { ABSENCE_CODES, type AbsenceCode } from '../../utils/absences';
import {
  DEFAULT_SHIFT_INTERVALS,
  intervalHours,
  isValidClockTime,
  resolveDailyWorkTimeDeviation,
  resolvePlanToFactOutcomes,
} from '../../utils/payroll';
import type { PlannedScheduleDay } from '../../utils/schedule';
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
  governingAbsence?: Absence | null;
  plannedDay?: PlannedScheduleDay;
  onClose: () => void;
  onSave: (
    hours: number,
    note: string | null,
    workTimeCorrection: WorkTimeCorrectionInput | null,
  ) => Promise<void>;
  onClear: () => Promise<void>;
  onSaveAbsence: (code: AbsenceCode, note: string | null) => Promise<void>;
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
  governingAbsence = null,
  plannedDay,
  onClose,
  onSave,
  onClear,
  onSaveAbsence,
}: DailyValueEditorDialogProps) {
  const t = useTranslations();
  const plannedHours = plannedDay?.hours ?? (day.isWorkingDay ? 8 : 0);
  const defaultHours =
    value.kind === 'empty' ? plannedHours : (value.hours ?? plannedHours);
  const plannedShiftFromSchedule = plannedDay?.shift ?? '';
  const [tab, setTab] = useState<'hours' | 'absence'>(
    hasGoverningAbsence ? 'absence' : 'hours',
  );
  const input = defaultHours.toString();
  const [note, setNote] = useState(
    () => value.coordinatorNote ?? governingAbsence?.note ?? '',
  );
  const [plannedShift, setPlannedShift] = useState<ActualWorkingShift | ''>(
    () => value.workTimeCorrection?.plannedShift ?? plannedShiftFromSchedule,
  );
  const [actualStartTime, setActualStartTime] = useState(
    () =>
      value.workTimeCorrection?.actualStartTime ??
      plannedDay?.plannedStartTime ??
      '',
  );
  const [actualEndTime, setActualEndTime] = useState(
    () =>
      value.workTimeCorrection?.actualEndTime ??
      plannedDay?.plannedEndTime ??
      '',
  );
  const [absenceCode, setAbsenceCode] = useState<AbsenceCode>(
    () => (governingAbsence?.absenceCode as AbsenceCode | undefined) ?? 'L4',
  );
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [validationError, setValidationError] =
    useState<DailyHoursValidationError | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const employeeName = `${employee.lastName} ${employee.firstName}`;
  const plannedInterval = plannedShift
    ? plannedDay?.shift === plannedShift &&
      plannedDay.plannedStartTime &&
      plannedDay.plannedEndTime
      ? {
          startTime: plannedDay.plannedStartTime,
          endTime: plannedDay.plannedEndTime,
        }
      : DEFAULT_SHIFT_INTERVALS[plannedShift]
    : null;
  const parsedHours = parseDailyHoursInput(input);
  const inferredActual =
    plannedInterval && actualStartTime && actualEndTime
      ? {
          startTime: actualStartTime,
          endTime: actualEndTime,
        }
      : null;
  const timeValidationError = Boolean(
    inferredActual &&
    (!isValidClockTime(inferredActual.startTime) ||
      !isValidClockTime(inferredActual.endTime)),
  );
  const actualTotal =
    inferredActual && !timeValidationError ? intervalHours(inferredActual) : 0;
  const effectiveParsedHours = timeValidationError
    ? parsedHours
    : ({ kind: 'value', hours: actualTotal } as const);
  const workTimePreview =
    inferredActual && plannedInterval && plannedShift && !timeValidationError
      ? resolveDailyWorkTimeDeviation({
          planned: { shift: plannedShift, ...plannedInterval },
          actual: inferredActual,
          isWorkingDay: day.isWorkingDay,
          isSaturday: day.date.getUTCDay() === 6,
          isSunday: day.date.getUTCDay() === 0,
          isPublicHoliday: day.isHoliday,
        })
      : null;
  const outcomes =
    inferredActual && plannedInterval && plannedShift && !timeValidationError
      ? resolvePlanToFactOutcomes({
          planned: { shift: plannedShift, ...plannedInterval },
          actual: inferredActual,
          isWorkingDay: day.isWorkingDay,
          isSaturday: day.date.getUTCDay() === 6,
          isSunday: day.date.getUTCDay() === 0,
          isPublicHoliday: day.isHoliday,
        })
      : [];
  const hasExplicitHours =
    value.kind === 'manual' ||
    value.kind === 'imported' ||
    value.kind === 'imported-override';
  const confirmedImportedL4 =
    governingAbsence?.absenceCode === 'L4' &&
    governingAbsence.source === 'absence_import';
  const multiDayAbsence = Boolean(
    governingAbsence && governingAbsence.startDate !== governingAbsence.endDate,
  );
  const replacementRequired = hasExplicitHours || Boolean(governingAbsence);
  const protectedImportedHours =
    value.kind === 'imported' || value.kind === 'imported-override';

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
    if (tab === 'absence') {
      if (confirmedImportedL4 || (replacementRequired && !replacementConfirmed))
        return;
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await onSaveAbsence(absenceCode, note.trim() || null);
        onClose();
      } catch {
        setSubmitError(t.settlement.editor.errors.absenceSave);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (confirmedImportedL4 || (hasGoverningAbsence && !replacementConfirmed))
      return;
    if (effectiveParsedHours.kind === 'error') {
      setValidationError(effectiveParsedHours.code);
      return;
    }
    if (timeValidationError || !plannedShift || !plannedInterval) return;
    const normalizedNote = note.trim() || null;
    const mutation = decideDailyValueMutation({
      parsed: effectiveParsedHours,
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
    if (mutation === 'none') return onClose();
    if (mutation === 'clear') return void clearValue();
    if (effectiveParsedHours.kind !== 'value' || !inferredActual) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const needsCorrection =
        effectiveParsedHours.hours !== plannedHours ||
        actualStartTime !== plannedInterval.startTime ||
        actualEndTime !== plannedInterval.endTime;
      await onSave(
        effectiveParsedHours.hours,
        normalizedNote,
        needsCorrection
          ? {
              plannedShift,
              plannedStartTime: plannedInterval.startTime,
              plannedEndTime: plannedInterval.endTime,
              actualStartTime: inferredActual.startTime,
              actualEndTime: inferredActual.endTime,
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
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{t.settlement.editor.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography color="text.secondary">
              {interpolate(t.settlement.editor.description, {
                employee: employeeName,
                date: dateFormatter.format(day.date),
              })}
            </Typography>
            {plannedDay ? (
              <Typography variant="body2" color="text.secondary">
                {interpolate(t.settlement.editor.planContext, {
                  hours: String(plannedHours),
                  shift: plannedDay.label,
                })}
              </Typography>
            ) : null}
            <Tabs
              value={tab}
              onChange={(_, value: 'hours' | 'absence') => setTab(value)}
            >
              <Tab value="hours" label={t.settlement.editor.tabs.hours} />
              <Tab value="absence" label={t.settlement.editor.tabs.absence} />
            </Tabs>
            {submitError ? <Alert severity="error">{submitError}</Alert> : null}

            {tab === 'hours' ? (
              <>
                {hasGoverningAbsence ? (
                  <>
                    <Alert severity={confirmedImportedL4 ? 'info' : 'warning'}>
                      {multiDayAbsence
                        ? t.settlement.editor.multiDayAbsenceReadOnly
                        : confirmedImportedL4
                          ? t.settlement.editor.confirmedL4ReadOnly
                          : t.settlement.editor.hoursAbsenceConflict}
                    </Alert>
                    {!confirmedImportedL4 && !multiDayAbsence ? (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={replacementConfirmed}
                            onChange={(_, checked) =>
                              setReplacementConfirmed(checked)
                            }
                          />
                        }
                        label={t.settlement.editor.confirmReplacement}
                      />
                    ) : null}
                  </>
                ) : null}
                <TextField
                  label={t.settlement.editor.actualHours}
                  value={formatHours(actualTotal)}
                  disabled
                  error={Boolean(validationError)}
                  helperText={
                    validationError
                      ? validationMessage(validationError, t)
                      : t.settlement.editor.helper
                  }
                />
                <Stack spacing={1.25}>
                  {!plannedShift ? (
                    <Alert severity="warning">
                      {t.settlement.editor.workTime.unresolvedShift}
                    </Alert>
                  ) : null}
                  <TextField
                    select
                    label={t.settlement.editor.workTime.plannedShift}
                    value={plannedShift}
                    onChange={(event) => {
                      const next = event.target.value as ActualWorkingShift;
                      const interval = DEFAULT_SHIFT_INTERVALS[next];
                      setPlannedShift(next);
                      if (!actualStartTime)
                        setActualStartTime(interval.startTime);
                      if (!actualEndTime) setActualEndTime(interval.endTime);
                    }}
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
                  {plannedInterval ? (
                    <Alert severity="info">
                      {interpolate(t.settlement.editor.workTime.planDetails, {
                        start: plannedInterval.startTime,
                        end: plannedInterval.endTime,
                        hours: formatHours(plannedHours),
                      })}
                    </Alert>
                  ) : null}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      label={t.settlement.editor.workTime.actualStart}
                      value={actualStartTime}
                      onChange={(event) =>
                        setActualStartTime(event.target.value)
                      }
                      placeholder={plannedInterval?.startTime ?? ''}
                      error={timeValidationError}
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
                      placeholder={plannedInterval?.endTime ?? ''}
                      error={timeValidationError}
                      helperText={t.settlement.editor.workTime.optional}
                    />
                  </Stack>
                  {workTimePreview ? (
                    <Stack spacing={1}>
                      <Alert
                        severity={
                          workTimePreview.unresolved ? 'warning' : 'info'
                        }
                      >
                        {interpolate(
                          t.settlement.editor.workTime.previewExtended,
                          {
                            planned: formatHours(plannedHours),
                            actual:
                              effectiveParsedHours.kind === 'value'
                                ? formatHours(effectiveParsedHours.hours)
                                : '—',
                            private: formatHours(
                              workTimePreview.privateTimeHours,
                            ),
                            overtime50: formatHours(
                              workTimePreview.overtime50Hours,
                            ),
                            overtime100: formatHours(
                              workTimePreview.overtime100Hours,
                            ),
                            night: formatHours(
                              workTimePreview.nightAllowanceHours,
                            ),
                          },
                        )}
                      </Alert>
                      <Typography variant="caption" color="text.secondary">
                        {outcomes
                          .map(
                            (outcome) =>
                              t.settlement.editor.workTime.outcomes[outcome],
                          )
                          .join(' · ')}
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </>
            ) : (
              <>
                {multiDayAbsence ? (
                  <Alert severity="info">
                    {t.settlement.editor.multiDayAbsenceReadOnly}
                  </Alert>
                ) : confirmedImportedL4 ? (
                  <Alert severity="info">
                    {t.settlement.editor.confirmedL4ReadOnly}
                  </Alert>
                ) : protectedImportedHours ? (
                  <Alert severity="info">
                    {t.settlement.editor.importedHoursReadOnly}
                  </Alert>
                ) : (
                  <TextField
                    select
                    autoFocus
                    label={t.settlement.editor.absenceType}
                    value={absenceCode}
                    onChange={(event) =>
                      setAbsenceCode(event.target.value as AbsenceCode)
                    }
                  >
                    {ABSENCE_CODES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {t.absences.types[code]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {absenceCode === 'L4' &&
                !confirmedImportedL4 &&
                !protectedImportedHours ? (
                  <Alert severity="warning">
                    {t.settlement.editor.manualL4Notice}
                  </Alert>
                ) : null}
                {replacementRequired &&
                !confirmedImportedL4 &&
                !protectedImportedHours ? (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={replacementConfirmed}
                        onChange={(_, value) => setReplacementConfirmed(value)}
                      />
                    }
                    label={t.settlement.editor.confirmReplacement}
                  />
                ) : null}
              </>
            )}

            <TextField
              label={t.settlement.editor.note}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {tab === 'hours' &&
          (value.kind === 'manual' || value.kind === 'imported-override') ? (
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
            disabled={
              isSubmitting ||
              (tab === 'hours' &&
                (!plannedShift ||
                  multiDayAbsence ||
                  confirmedImportedL4 ||
                  (hasGoverningAbsence && !replacementConfirmed))) ||
              (tab === 'absence' &&
                (multiDayAbsence ||
                  confirmedImportedL4 ||
                  protectedImportedHours ||
                  (replacementRequired && !replacementConfirmed)))
            }
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
  if (code === 'negative') return t.settlement.editor.validation.negative;
  if (code === 'above-maximum')
    return t.settlement.editor.validation.aboveMaximum;
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
  if (code === 'authentication-required')
    return t.settlement.editor.errors.authentication;
  if (code === 'firebase-unavailable')
    return t.settlement.editor.errors.firebase;
  return operation === 'save'
    ? t.settlement.editor.errors.save
    : t.settlement.editor.errors.clear;
}

function formatHours(hours: number): string {
  return hours.toLocaleString('pl-PL');
}
