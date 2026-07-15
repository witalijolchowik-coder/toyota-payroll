import type {
  ActualWorkingShift,
  DepartmentId,
  DepartmentShiftCorrection,
  DepartmentShiftMode,
  EmployeeColorShift,
  IsoDate,
  ShiftHoursVersion,
  ShiftInterval,
} from '../../types/firestore';
import {
  allowedColorShiftsForMode,
  getCanonicalDepartmentDefinition,
} from '../organization';
import { intervalHours, isValidClockTime } from '../payroll';

export const DEFAULT_SHIFT_HOURS: Record<ActualWorkingShift, ShiftInterval> = {
  FIRST: { startTime: '06:00', endTime: '14:00' },
  SECOND: { startTime: '14:00', endTime: '22:00' },
  NIGHT: { startTime: '22:00', endTime: '06:00' },
};

export const THREE_SHIFT_SEQUENCE: readonly ActualWorkingShift[] = [
  'NIGHT',
  'SECOND',
  'FIRST',
];
export const TWO_SHIFT_SEQUENCE: readonly ActualWorkingShift[] = [
  'FIRST',
  'SECOND',
];

export interface ShiftCorrectionValidation {
  valid: boolean;
  errors: Array<
    'missing-group' | 'duplicate-shift' | 'invalid-night' | 'blue-not-allowed'
  >;
}

export interface RotationPreviewWeek {
  weekStart: IsoDate;
  assignments: Partial<Record<EmployeeColorShift, ActualWorkingShift>>;
  selected: boolean;
}

export function resolveShiftHoursVersion(
  versions: readonly ShiftHoursVersion[],
  date: IsoDate,
): ShiftHoursVersion | null {
  return (
    versions
      .filter((version) => version.active && version.validFrom <= date)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null
  );
}

export function resolveShiftInterval(
  shift: ActualWorkingShift,
  date: IsoDate,
  versions: readonly ShiftHoursVersion[] = [],
): ShiftInterval {
  return (
    resolveShiftHoursVersion(versions, date)?.intervals[shift] ??
    DEFAULT_SHIFT_HOURS[shift]
  );
}

export function validateShiftHours(
  intervals: Record<ActualWorkingShift, ShiftInterval>,
): boolean {
  return (Object.keys(intervals) as ActualWorkingShift[]).every((shift) => {
    const interval = intervals[shift];
    return (
      isValidClockTime(interval.startTime) &&
      isValidClockTime(interval.endTime) &&
      intervalHours(interval) > 0 &&
      intervalHours(interval) <= 12
    );
  });
}

export function resolveDepartmentShiftCorrection(
  corrections: readonly DepartmentShiftCorrection[],
  departmentId: DepartmentId,
  date: IsoDate,
): DepartmentShiftCorrection | null {
  const active = corrections
    .filter(
      (correction) =>
        correction.departmentId === departmentId &&
        correction.status === 'ACTIVE',
    )
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  if (active.length === 0) return null;

  const preceding = active.filter(
    (correction) => correction.effectiveDate <= date,
  );
  return preceding.at(-1) ?? active[0] ?? null;
}

export function resolveDepartmentMode(
  departmentId: DepartmentId,
  date: IsoDate,
  corrections: readonly DepartmentShiftCorrection[],
  fallbackMode?: DepartmentShiftMode,
): Exclude<DepartmentShiftMode, 'UNKNOWN'> | null {
  const correction = resolveDepartmentShiftCorrection(
    corrections,
    departmentId,
    date,
  );
  if (correction) return correction.shiftMode;
  const canonical = getCanonicalDepartmentDefinition(departmentId);
  const fallback =
    fallbackMode && fallbackMode !== 'UNKNOWN'
      ? fallbackMode
      : canonical?.shiftMode;
  return fallback ?? null;
}

export function validateDepartmentShiftCorrection({
  shiftMode,
  groupAssignments,
}: Pick<
  DepartmentShiftCorrection,
  'shiftMode' | 'groupAssignments'
>): ShiftCorrectionValidation {
  const groups = allowedColorShiftsForMode(shiftMode);
  const assigned = groups
    .map((group) => groupAssignments[group])
    .filter(Boolean) as ActualWorkingShift[];
  const errors: ShiftCorrectionValidation['errors'] = [];
  if (assigned.length !== groups.length) errors.push('missing-group');
  if (new Set(assigned).size !== assigned.length)
    errors.push('duplicate-shift');
  if (shiftMode === 'TWO_SHIFT' && assigned.includes('NIGHT'))
    errors.push('invalid-night');
  if (shiftMode === 'TWO_SHIFT' && groupAssignments.BLUE)
    errors.push('blue-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function rotateShiftForWeek(
  baseShift: ActualWorkingShift,
  weekOffset: number,
  shiftMode: Exclude<DepartmentShiftMode, 'UNKNOWN'>,
): ActualWorkingShift | null {
  const sequence =
    shiftMode === 'TWO_SHIFT' ? TWO_SHIFT_SEQUENCE : THREE_SHIFT_SEQUENCE;
  const index = sequence.indexOf(baseShift);
  if (index < 0) return null;
  return sequence[positiveModulo(index + weekOffset, sequence.length)] ?? null;
}

export function resolveDepartmentRotationShift({
  departmentId,
  shiftAssignment,
  date,
  corrections,
  fallbackMode,
  fallbackAnchor,
  fallbackAssignments,
}: {
  departmentId: DepartmentId;
  shiftAssignment: EmployeeColorShift;
  date: IsoDate;
  corrections: readonly DepartmentShiftCorrection[];
  fallbackMode?: DepartmentShiftMode;
  fallbackAnchor?: IsoDate | null;
  fallbackAssignments?: Partial<
    Record<EmployeeColorShift, ActualWorkingShift>
  > | null;
}): ActualWorkingShift | null {
  const correction = resolveDepartmentShiftCorrection(
    corrections,
    departmentId,
    date,
  );
  const mode = resolveDepartmentMode(
    departmentId,
    date,
    corrections,
    fallbackMode,
  );
  if (!mode || !allowedColorShiftsForMode(mode).includes(shiftAssignment))
    return null;
  const canonical = getCanonicalDepartmentDefinition(departmentId);
  const anchor =
    correction?.effectiveDate ??
    fallbackAnchor ??
    canonical?.rotationAnchor.weekStartIsoDate;
  const assignments =
    correction?.groupAssignments ??
    fallbackAssignments ??
    canonical?.rotationAnchor.baseAssignment;
  const baseShift = assignments?.[shiftAssignment];
  if (!anchor || !baseShift) return null;
  return rotateShiftForWeek(baseShift, wholeWeeksBetween(anchor, date), mode);
}

export function previewDepartmentRotation(
  correction: Pick<
    DepartmentShiftCorrection,
    'effectiveDate' | 'shiftMode' | 'groupAssignments'
  >,
  weeksBefore = 1,
  weeksAfter = 4,
): RotationPreviewWeek[] {
  const selectedWeek = startOfIsoWeek(correction.effectiveDate);
  const groups = allowedColorShiftsForMode(correction.shiftMode);
  const result: RotationPreviewWeek[] = [];
  for (let offset = -weeksBefore; offset <= weeksAfter; offset += 1) {
    result.push({
      weekStart: addIsoDays(selectedWeek, offset * 7),
      selected: offset === 0,
      assignments: Object.fromEntries(
        groups.map((group) => [
          group,
          correction.groupAssignments[group]
            ? rotateShiftForWeek(
                correction.groupAssignments[group]!,
                offset,
                correction.shiftMode,
              )
            : undefined,
        ]),
      ),
    });
  }
  return result;
}

// ISO week boundary: Monday 00:00 UTC. A correction selected mid-week anchors
// the phase for that whole calendar week, both backward and forward.
export function startOfIsoWeek(date: IsoDate): IsoDate {
  const value = isoDateToDate(date);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10) as IsoDate;
}

function wholeWeeksBetween(anchor: IsoDate, date: IsoDate): number {
  return Math.floor(
    (isoDateToDate(startOfIsoWeek(date)).getTime() -
      isoDateToDate(startOfIsoWeek(anchor)).getTime()) /
      (7 * 24 * 60 * 60 * 1000),
  );
}

function addIsoDays(date: IsoDate, days: number): IsoDate {
  const value = isoDateToDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10) as IsoDate;
}

function isoDateToDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
