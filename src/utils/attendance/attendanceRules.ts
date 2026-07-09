import type { DailyValue } from '../../types/firestore';

export type ExplicitAttendanceKind =
  'manual' | 'imported' | 'imported-override';

export type AttendanceWarning =
  'absence-conflict' | 'non-working-explicit' | 'outside-employment';

export type ManualAttendanceClearOperation =
  | 'delete-manual-daily-value'
  | 'clear-imported-override'
  | 'preserve-imported-value'
  | 'noop';

export interface EffectiveAttendanceValue {
  kind: ExplicitAttendanceKind;
  hours: number;
  originalHours: number;
  note: string | null;
}

export function resolveEffectiveAttendanceValue(
  value: Pick<DailyValue, 'hours' | 'source' | 'note' | 'manualOverride'>,
): EffectiveAttendanceValue {
  if (value.source === 'attendance_import' && value.manualOverride) {
    return {
      kind: 'imported-override',
      hours: value.manualOverride.hours,
      originalHours: value.hours,
      note: value.manualOverride.note,
    };
  }

  return {
    kind: value.source === 'manual' ? 'manual' : 'imported',
    hours: value.hours,
    originalHours: value.hours,
    note: value.note,
  };
}

export function resolveAttendanceWarnings({
  hasExplicitValue,
  hasActiveAbsence,
  isWorkingDay,
  isWithinEmployment,
}: {
  hasExplicitValue: boolean;
  hasActiveAbsence: boolean;
  isWorkingDay: boolean;
  isWithinEmployment: boolean;
}): AttendanceWarning[] {
  if (!hasExplicitValue) {
    return [];
  }

  const warnings: AttendanceWarning[] = [];
  if (hasActiveAbsence) {
    warnings.push('absence-conflict');
  }
  if (!isWorkingDay) {
    warnings.push('non-working-explicit');
  }
  if (!isWithinEmployment) {
    warnings.push('outside-employment');
  }
  return warnings;
}

export function isValidWorkedHours(hours: number): boolean {
  return Number.isFinite(hours) && hours >= 0 && hours <= 24;
}

export function resolveManualAttendanceClearOperation(
  value: Pick<DailyValue, 'source' | 'manualOverride'> | null,
): ManualAttendanceClearOperation {
  if (!value) {
    return 'noop';
  }
  if (value.source === 'manual') {
    return 'delete-manual-daily-value';
  }
  if (value.manualOverride) {
    return 'clear-imported-override';
  }
  return 'preserve-imported-value';
}
