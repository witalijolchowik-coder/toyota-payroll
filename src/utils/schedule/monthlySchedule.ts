import type {
  ActualWorkingShift,
  Department,
  Employee,
  EmployeeAssignment,
  EmployeeColorShift,
  IsoDate,
  ScheduleCorrection,
} from '../../types/firestore';
import {
  CANONICAL_DEPARTMENTS,
  allowedColorShiftsForMode,
  getCanonicalDepartmentDefinition,
} from '../organization';
import {
  STANDARD_WORKING_DAY_HOURS,
  type PayrollCalendarOverrideMap,
  isPayrollWorkingDay,
} from '../payroll';
import { dateToIsoDate } from '../payroll/month';

export type PlannedScheduleSource =
  | 'automatic'
  | 'bhp'
  | 'calendar'
  | 'manual-correction'
  | 'unresolved'
  | 'outside-employment';

export type PlannedScheduleStatus =
  | 'WORKING'
  | 'BHP'
  | 'DAY_OFF'
  | 'PUBLIC_HOLIDAY'
  | 'OUTSIDE_EMPLOYMENT'
  | 'UNRESOLVED';

export interface PlannedScheduleDay {
  employeeId: string;
  date: IsoDate;
  status: PlannedScheduleStatus;
  source: PlannedScheduleSource;
  hours: number | null;
  shift: ActualWorkingShift | null;
  label: string;
  departmentId: string | null;
  shiftAssignment: EmployeeColorShift | null;
  reason: string | null;
  holidayName: string | null;
}

export interface MonthlyScheduleOptions {
  publicHolidays?: ReadonlySet<IsoDate>;
  publicHolidayNames?: ReadonlyMap<IsoDate, string>;
  overrides?: PayrollCalendarOverrideMap;
  assignments?: readonly EmployeeAssignment[];
  corrections?: readonly ScheduleCorrection[];
}

export function generateEmployeeMonthlySchedule({
  employee,
  days,
  departments,
  options = {},
}: {
  employee: Employee;
  days: readonly { date: Date; isoDate: IsoDate; isWorkingDay: boolean }[];
  departments: readonly Department[];
  options?: MonthlyScheduleOptions;
}): PlannedScheduleDay[] {
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const correctionsByDate = new Map(
    (options.corrections ?? [])
      .filter(
        (correction) =>
          correction.employeeId === employee.id &&
          correction.status === 'ACTIVE',
      )
      .map((correction) => [correction.date, correction]),
  );
  const bhpDates = getBhpIsoDates(employee, days, options);

  return days.map((day) => {
    const correction = correctionsByDate.get(day.isoDate);
    const base = resolveAutomaticScheduleDay({
      employee,
      day,
      departmentsById,
      assignments: options.assignments ?? [],
      bhpDates,
      publicHolidayNames: options.publicHolidayNames,
    });

    if (!correction || base.status === 'OUTSIDE_EMPLOYMENT') {
      return base;
    }

    return applyScheduleCorrection(base, correction);
  });
}

export function resolveEffectiveAssignment(
  employee: Employee,
  date: IsoDate,
  assignments: readonly EmployeeAssignment[] = [],
): Pick<EmployeeAssignment, 'departmentId' | 'shiftAssignment'> {
  const activeAssignments = assignments
    .filter(
      (assignment) =>
        assignment.employeeId === employee.id &&
        assignment.status === 'ACTIVE' &&
        assignment.validFrom <= date &&
        (!assignment.validTo || assignment.validTo >= date),
    )
    .sort((first, second) => second.validFrom.localeCompare(first.validFrom));

  const assignment = activeAssignments[0];
  if (assignment) {
    return {
      departmentId: assignment.departmentId,
      shiftAssignment: assignment.shiftAssignment,
    };
  }

  return {
    departmentId: employee.departmentId,
    shiftAssignment: employee.shiftAssignment,
  };
}

export function resolveRotatingShift({
  department,
  shiftAssignment,
  date,
}: {
  department: Department;
  shiftAssignment: EmployeeColorShift;
  date: IsoDate;
}): ActualWorkingShift | null {
  const canonical = getCanonicalDepartmentDefinition(department.id);
  const shiftMode =
    department.shiftMode === 'UNKNOWN'
      ? canonical?.shiftMode
      : department.shiftMode;
  if (!shiftMode) {
    return null;
  }

  const allowedColors = allowedColorShiftsForMode(shiftMode);
  if (!allowedColors.includes(shiftAssignment)) {
    return null;
  }

  const anchorWeekStart =
    department.rotationAnchorWeekStart ??
    canonical?.rotationAnchor.weekStartIsoDate;
  const baseAssignment =
    department.rotationBaseAssignment ??
    canonical?.rotationAnchor.baseAssignment;
  const baseShift = baseAssignment?.[shiftAssignment];

  if (!anchorWeekStart || !baseShift) {
    return null;
  }

  if (shiftMode === 'TWO_SHIFT') {
    return rotateShift(baseShift, date, anchorWeekStart, ['FIRST', 'SECOND']);
  }

  return rotateShift(baseShift, date, anchorWeekStart, [
    'NIGHT',
    'SECOND',
    'FIRST',
  ]);
}

export function getBhpIsoDates(
  employee: Employee,
  days: readonly { isoDate: IsoDate }[],
  options: {
    publicHolidays?: ReadonlySet<IsoDate>;
    overrides?: PayrollCalendarOverrideMap;
  } = {},
): Set<IsoDate> {
  if (!employee.employmentStartDate || days.length === 0) {
    return new Set();
  }

  const result = new Set<IsoDate>();
  const firstDay = days[0].isoDate;
  const lastDay = days[days.length - 1].isoDate;
  let cursor = dateToIsoDate(employee.employmentStartDate);
  let safety = 0;

  while (cursor <= lastDay && result.size < 2 && safety < 90) {
    if (
      cursor >= firstDay &&
      isPayrollWorkingDay(isoDateToDate(cursor), options)
    ) {
      result.add(cursor);
    } else if (
      cursor < firstDay &&
      isPayrollWorkingDay(isoDateToDate(cursor), options)
    ) {
      result.add(`outside:${cursor}` as IsoDate);
    }

    cursor = addIsoDays(cursor, 1);
    safety += 1;
  }

  return new Set([...result].filter((date) => !date.startsWith('outside:')));
}

export function hasNoBlankRelevantScheduleDays(
  schedule: readonly PlannedScheduleDay[],
): boolean {
  return schedule.every((day) => day.label.length > 0);
}

function resolveAutomaticScheduleDay({
  employee,
  day,
  departmentsById,
  assignments,
  bhpDates,
  publicHolidayNames,
}: {
  employee: Employee;
  day: { date: Date; isoDate: IsoDate; isWorkingDay: boolean };
  departmentsById: ReadonlyMap<string, Department>;
  assignments: readonly EmployeeAssignment[];
  bhpDates: ReadonlySet<IsoDate>;
  publicHolidayNames?: ReadonlyMap<IsoDate, string>;
}): PlannedScheduleDay {
  if (!isDateWithinEmployeePeriod(employee, day.isoDate)) {
    return createScheduleDay(employee, day.isoDate, {
      status: 'OUTSIDE_EMPLOYMENT',
      source: 'outside-employment',
      hours: null,
      shift: null,
      label: '—',
      reason: null,
      holidayName: null,
    });
  }

  const holidayName = publicHolidayNames?.get(day.isoDate) ?? null;
  if (!day.isWorkingDay) {
    return createScheduleDay(employee, day.isoDate, {
      status: holidayName ? 'PUBLIC_HOLIDAY' : 'DAY_OFF',
      source: 'calendar',
      hours: 0,
      shift: null,
      label: holidayName ? 'Ś' : 'W',
      reason: holidayName,
      holidayName,
    });
  }

  const assignment = resolveEffectiveAssignment(
    employee,
    day.isoDate,
    assignments,
  );
  const department = assignment.departmentId
    ? departmentsById.get(assignment.departmentId)
    : null;

  if (bhpDates.has(day.isoDate)) {
    return createScheduleDay(employee, day.isoDate, {
      status: 'BHP',
      source: 'bhp',
      hours: STANDARD_WORKING_DAY_HOURS,
      shift: 'FIRST',
      label: 'BHP / 1',
      departmentId: assignment.departmentId,
      shiftAssignment: assignment.shiftAssignment,
      reason: null,
      holidayName,
    });
  }

  if (!assignment.departmentId || !department || !department.active) {
    return createScheduleDay(employee, day.isoDate, {
      status: 'UNRESOLVED',
      source: 'unresolved',
      hours: null,
      shift: null,
      label: '!',
      departmentId: assignment.departmentId,
      shiftAssignment: assignment.shiftAssignment,
      reason: 'department-unresolved',
      holidayName,
    });
  }

  if (!assignment.shiftAssignment) {
    return createScheduleDay(employee, day.isoDate, {
      status: 'UNRESOLVED',
      source: 'unresolved',
      hours: null,
      shift: null,
      label: '!',
      departmentId: assignment.departmentId,
      shiftAssignment: null,
      reason: 'shift-unresolved-after-bhp',
      holidayName,
    });
  }

  const shift = resolveRotatingShift({
    department,
    shiftAssignment: assignment.shiftAssignment,
    date: day.isoDate,
  });

  if (!shift) {
    return createScheduleDay(employee, day.isoDate, {
      status: 'UNRESOLVED',
      source: 'unresolved',
      hours: null,
      shift: null,
      label: '!',
      departmentId: assignment.departmentId,
      shiftAssignment: assignment.shiftAssignment,
      reason: 'rotation-unresolved',
      holidayName,
    });
  }

  return createScheduleDay(employee, day.isoDate, {
    status: 'WORKING',
    source: 'automatic',
    hours: STANDARD_WORKING_DAY_HOURS,
    shift,
    label: `${STANDARD_WORKING_DAY_HOURS} / ${shiftCode(shift)}`,
    departmentId: assignment.departmentId,
    shiftAssignment: assignment.shiftAssignment,
    reason: null,
    holidayName,
  });
}

function applyScheduleCorrection(
  base: PlannedScheduleDay,
  correction: ScheduleCorrection,
): PlannedScheduleDay {
  if (correction.kind === 'DAY_OFF') {
    return {
      ...base,
      status: 'DAY_OFF',
      source: 'manual-correction',
      hours: 0,
      shift: null,
      label: 'W',
      reason: correction.note,
    };
  }

  if (correction.kind === 'BHP') {
    return {
      ...base,
      status: 'BHP',
      source: 'manual-correction',
      hours: correction.plannedHours ?? STANDARD_WORKING_DAY_HOURS,
      shift: 'FIRST',
      label: 'BHP / 1',
      reason: correction.note,
    };
  }

  const shift =
    correction.plannedShift ??
    (correction.kind === 'FIRST_SHIFT'
      ? 'FIRST'
      : correction.kind === 'SECOND_SHIFT'
        ? 'SECOND'
        : 'NIGHT');
  const hours = correction.plannedHours ?? STANDARD_WORKING_DAY_HOURS;

  return {
    ...base,
    status: 'WORKING',
    source: 'manual-correction',
    hours,
    shift,
    label: `${hours} / ${shiftCode(shift)}`,
    reason: correction.note,
  };
}

function createScheduleDay(
  employee: Employee,
  date: IsoDate,
  values: Omit<
    PlannedScheduleDay,
    'employeeId' | 'date' | 'departmentId' | 'shiftAssignment'
  > & {
    departmentId?: string | null;
    shiftAssignment?: EmployeeColorShift | null;
  },
): PlannedScheduleDay {
  return {
    employeeId: employee.id,
    date,
    departmentId: values.departmentId ?? employee.departmentId,
    shiftAssignment: values.shiftAssignment ?? employee.shiftAssignment,
    ...values,
  };
}

function rotateShift(
  baseShift: ActualWorkingShift,
  date: IsoDate,
  anchorWeekStart: IsoDate,
  cycle: readonly ActualWorkingShift[],
): ActualWorkingShift | null {
  const baseIndex = cycle.indexOf(baseShift);
  if (baseIndex < 0) {
    return null;
  }

  const weekOffset = wholeWeeksBetween(anchorWeekStart, date);
  const index = positiveModulo(baseIndex + weekOffset, cycle.length);
  return cycle[index];
}

function wholeWeeksBetween(anchorWeekStart: IsoDate, date: IsoDate): number {
  const milliseconds =
    isoDateToDate(date).getTime() - isoDateToDate(anchorWeekStart).getTime();
  return Math.floor(milliseconds / (7 * 24 * 60 * 60 * 1000));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function shiftCode(shift: ActualWorkingShift): '1' | '2' | 'N' {
  if (shift === 'FIRST') {
    return '1';
  }
  if (shift === 'SECOND') {
    return '2';
  }
  return 'N';
}

function isDateWithinEmployeePeriod(
  employee: Employee,
  isoDate: IsoDate,
): boolean {
  if (!employee.employmentStartDate) {
    return false;
  }
  const start = dateToIsoDate(employee.employmentStartDate);
  const end = employee.employmentEndDate
    ? dateToIsoDate(employee.employmentEndDate)
    : null;
  return start <= isoDate && (!end || end >= isoDate);
}

function isoDateToDate(isoDate: IsoDate): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function addIsoDays(isoDate: IsoDate, days: number): IsoDate {
  const date = isoDateToDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToIsoDate(date);
}

export const defaultCanonicalScheduleDepartments = CANONICAL_DEPARTMENTS;
