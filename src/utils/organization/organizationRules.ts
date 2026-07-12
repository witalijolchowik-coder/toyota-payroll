import type {
  ActualWorkingShift,
  DepartmentId,
  DepartmentShiftMode,
  EmployeeColorShift,
  IsoDate,
} from '../../types/firestore';

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

export interface DepartmentRotationAnchor {
  weekStartIsoDate: IsoDate;
  baseAssignment: Partial<Record<EmployeeColorShift, ActualWorkingShift>>;
}

export interface CanonicalDepartmentDefinition {
  id: DepartmentId;
  name: string;
  shiftMode: Exclude<DepartmentShiftMode, 'UNKNOWN'>;
  allowedColorShifts: EmployeeColorShift[];
  rotationAnchor: DepartmentRotationAnchor;
  aliases: string[];
}

const DEFAULT_ROTATION_WEEK_START = '2026-01-05' as IsoDate;

export const CANONICAL_DEPARTMENTS: readonly CanonicalDepartmentDefinition[] = [
  {
    id: 'metal',
    name: 'Metal',
    shiftMode: 'THREE_SHIFT',
    allowedColorShifts: ['RED', 'WHITE', 'BLUE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND', BLUE: 'NIGHT' },
    },
    aliases: ['metal'],
  },
  {
    id: 'szwalnia',
    name: 'Szwalnia',
    shiftMode: 'TWO_SHIFT',
    allowedColorShifts: ['RED', 'WHITE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND' },
    },
    aliases: ['szwalnia'],
  },
  {
    id: 'montaz',
    name: 'Montaż',
    shiftMode: 'THREE_SHIFT',
    allowedColorShifts: ['RED', 'WHITE', 'BLUE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND', BLUE: 'NIGHT' },
    },
    aliases: ['montaz', 'montaż'],
  },
  {
    id: 'pu',
    name: 'PU',
    shiftMode: 'TWO_SHIFT',
    allowedColorShifts: ['RED', 'WHITE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND' },
    },
    aliases: ['pu'],
  },
  {
    id: 'headliner',
    name: 'Headliner',
    shiftMode: 'TWO_SHIFT',
    allowedColorShifts: ['RED', 'WHITE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND' },
    },
    aliases: ['headliner'],
  },
  {
    id: 'magazyn',
    name: 'Magazyn',
    shiftMode: 'THREE_SHIFT',
    allowedColorShifts: ['RED', 'WHITE', 'BLUE'],
    rotationAnchor: {
      weekStartIsoDate: DEFAULT_ROTATION_WEEK_START,
      baseAssignment: { RED: 'FIRST', WHITE: 'SECOND', BLUE: 'NIGHT' },
    },
    aliases: ['magazyn'],
  },
];

export const INITIAL_DEPARTMENT_NAMES = CANONICAL_DEPARTMENTS.map(
  (department) => department.name,
);

export const CANONICAL_DEPARTMENT_IDS = CANONICAL_DEPARTMENTS.map(
  (department) => department.id,
);

export type CanonicalDepartmentResolution =
  | {
      status: 'matched';
      department: CanonicalDepartmentDefinition;
    }
  | {
      status: 'unresolved-na0';
    }
  | {
      status: 'unknown';
    };

export type WeeklyRotationMap = Partial<
  Record<EmployeeColorShift, ActualWorkingShift>
>;

export type WeeklyRotationDirection =
  'night-to-second-to-first-to-night' | 'first-to-second-to-first' | 'manual';

export interface WeeklyRotationRule {
  departmentShiftMode: DepartmentShiftMode;
  baseWeekStartIsoDate: string;
  baseAssignment: WeeklyRotationMap;
  direction: WeeklyRotationDirection;
}

export function normalizeDepartmentName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeDepartmentMatchKey(value: string): string {
  return normalizeDepartmentName(value)
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
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

export function isCanonicalDepartmentId(value: string): value is DepartmentId {
  return CANONICAL_DEPARTMENT_IDS.includes(value);
}

export function getCanonicalDepartmentDefinition(
  departmentId: DepartmentId | null | undefined,
): CanonicalDepartmentDefinition | null {
  return (
    CANONICAL_DEPARTMENTS.find(
      (department) => department.id === departmentId,
    ) ?? null
  );
}

export function resolveCanonicalDepartment(
  value: string | null | undefined,
): CanonicalDepartmentResolution {
  const key = normalizeDepartmentMatchKey(value ?? '');
  if (!key) {
    return { status: 'unknown' };
  }

  if (key === 'na0') {
    return { status: 'unresolved-na0' };
  }

  const department = CANONICAL_DEPARTMENTS.find((candidate) =>
    [candidate.id, candidate.name, ...candidate.aliases].some(
      (alias) => normalizeDepartmentMatchKey(alias) === key,
    ),
  );

  if (!department) {
    return { status: 'unknown' };
  }

  return { status: 'matched', department };
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
