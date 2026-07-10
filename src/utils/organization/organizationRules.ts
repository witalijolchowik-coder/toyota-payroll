import type {
  ActualWorkingShift,
  DepartmentShiftMode,
  EmployeeColorShift,
} from '../../types/firestore';

export const INITIAL_DEPARTMENT_NAMES = [
  'Metal',
  'Szwalnia',
  'Montaż',
  'Headliner',
  'Magazyn',
  'PU',
] as const;

export const EMPLOYEE_COLOR_SHIFTS: EmployeeColorShift[] = [
  'RED',
  'WHITE',
  'BLUE',
];

export const ACTUAL_WORKING_SHIFTS: ActualWorkingShift[] = [
  'FIRST',
  'SECOND',
  'NIGHT',
];

export const DEPARTMENT_SHIFT_MODES: DepartmentShiftMode[] = [
  'UNKNOWN',
  'TWO_SHIFT',
  'THREE_SHIFT',
];

export type WeeklyRotationMap = Partial<
  Record<EmployeeColorShift, ActualWorkingShift>
>;

export type WeeklyRotationDirection =
  'night-to-second-to-first-to-night' | 'manual';

export interface WeeklyRotationRule {
  departmentShiftMode: DepartmentShiftMode;
  baseWeekStartIsoDate: string;
  baseAssignment: WeeklyRotationMap;
  direction: WeeklyRotationDirection;
}

export function normalizeDepartmentName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function departmentKeyFromName(value: string): string {
  return normalizeDepartmentName(value)
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isValidDepartmentName(value: string): boolean {
  return normalizeDepartmentName(value).length > 0;
}

export function isEmployeeColorShift(
  value: string | null,
): value is EmployeeColorShift {
  return value === 'RED' || value === 'WHITE' || value === 'BLUE';
}

export function isDepartmentShiftMode(
  value: string,
): value is DepartmentShiftMode {
  return (
    value === 'UNKNOWN' || value === 'TWO_SHIFT' || value === 'THREE_SHIFT'
  );
}

export function colorShiftLabelKey(
  value: EmployeeColorShift | null,
): 'unassigned' | EmployeeColorShift {
  return value ?? 'unassigned';
}

export function allowedColorShiftsForMode(
  mode: DepartmentShiftMode,
): EmployeeColorShift[] {
  if (mode === 'TWO_SHIFT') {
    return ['RED', 'WHITE'];
  }
  if (mode === 'THREE_SHIFT') {
    return ['RED', 'WHITE', 'BLUE'];
  }
  return [...EMPLOYEE_COLOR_SHIFTS];
}

export function resolveWeeklyRotationAssignment(
  rule: WeeklyRotationRule | null,
): WeeklyRotationMap {
  if (!rule || rule.departmentShiftMode === 'UNKNOWN') {
    return {};
  }

  const allowed = new Set(allowedColorShiftsForMode(rule.departmentShiftMode));
  return Object.fromEntries(
    Object.entries(rule.baseAssignment).filter(
      ([color, shift]) =>
        allowed.has(color as EmployeeColorShift) &&
        ACTUAL_WORKING_SHIFTS.includes(shift as ActualWorkingShift),
    ),
  ) as WeeklyRotationMap;
}
