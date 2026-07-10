import type { AbsenceCode } from '../../utils/absences';
import type {
  DepartmentId,
  Employee,
  EmployeeColorShift,
  EmployeeId,
  IsoDate,
} from '../../types/firestore';
import type { CalendarDay } from './monthUtils';

export const CALENDAR_CONSTRUCTOR_TOOLS = [
  'review',
  'hours',
  'L4',
  'UW',
  'UZ',
  'NN',
  'clear-manual',
] as const;

export type CalendarConstructorTool =
  (typeof CALENDAR_CONSTRUCTOR_TOOLS)[number];
export type CalendarConstructorAbsenceTool = Extract<
  CalendarConstructorTool,
  AbsenceCode
>;

export type CalendarConstructorOperation =
  | { kind: 'review' }
  | { kind: 'hours' }
  | { kind: 'absence'; absenceCode: AbsenceCode }
  | { kind: 'clear-manual-attendance' };

export interface CalendarRangeSelection {
  employeeId: EmployeeId;
  startDate: IsoDate;
  endDate: IsoDate;
}

export interface CalendarConstructorGuardContext {
  isSettled: boolean;
  selectedTool: CalendarConstructorTool;
  containsOutsideEmployment: boolean;
}

export interface CalendarConstructorOrganizationFilters {
  departmentId: DepartmentId | 'all' | 'unassigned';
  shiftAssignment: EmployeeColorShift | 'all' | 'unassigned';
}

export type CalendarConstructorBlockedReason =
  'settled-month' | 'outside-employment' | null;

const ABSENCE_TOOL_CODES = new Set<CalendarConstructorTool>([
  'L4',
  'UW',
  'UZ',
  'NN',
]);

export function isSupportedCalendarConstructorTool(
  tool: string,
): tool is CalendarConstructorTool {
  return CALENDAR_CONSTRUCTOR_TOOLS.includes(tool as CalendarConstructorTool);
}

export function calendarToolOperation(
  tool: CalendarConstructorTool,
): CalendarConstructorOperation {
  if (tool === 'review') {
    return { kind: 'review' };
  }
  if (tool === 'hours') {
    return { kind: 'hours' };
  }
  if (tool === 'clear-manual') {
    return { kind: 'clear-manual-attendance' };
  }
  return { kind: 'absence', absenceCode: tool };
}

export function buildSingleEmployeeRangeSelection({
  employeeId,
  anchorDate,
  targetDate,
}: {
  employeeId: EmployeeId;
  anchorDate: IsoDate;
  targetDate: IsoDate;
}): CalendarRangeSelection {
  return {
    employeeId,
    startDate: anchorDate <= targetDate ? anchorDate : targetDate,
    endDate: anchorDate <= targetDate ? targetDate : anchorDate,
  };
}

export function updateSingleEmployeeRangeSelection({
  current,
  employeeId,
  date,
}: {
  current: CalendarRangeSelection | null;
  employeeId: EmployeeId;
  date: IsoDate;
}): CalendarRangeSelection {
  if (!current || current.employeeId !== employeeId) {
    return { employeeId, startDate: date, endDate: date };
  }

  return buildSingleEmployeeRangeSelection({
    employeeId,
    anchorDate: current.startDate,
    targetDate: date,
  });
}

export function isDateInRangeSelection(
  selection: CalendarRangeSelection | null,
  employeeId: EmployeeId,
  date: IsoDate,
): boolean {
  return Boolean(
    selection &&
    selection.employeeId === employeeId &&
    date >= selection.startDate &&
    date <= selection.endDate,
  );
}

export function datesInRangeSelection(
  days: readonly CalendarDay[],
  selection: CalendarRangeSelection,
): CalendarDay[] {
  return days.filter(
    (day) =>
      day.isoDate >= selection.startDate && day.isoDate <= selection.endDate,
  );
}

export function calendarConstructorBlockedReason({
  isSettled,
  selectedTool,
  containsOutsideEmployment,
}: CalendarConstructorGuardContext): CalendarConstructorBlockedReason {
  if (selectedTool === 'review') {
    return null;
  }
  if (isSettled) {
    return 'settled-month';
  }
  if (containsOutsideEmployment) {
    return 'outside-employment';
  }
  return null;
}

export function isAbsenceCalendarTool(
  tool: CalendarConstructorTool,
): tool is CalendarConstructorAbsenceTool {
  return ABSENCE_TOOL_CODES.has(tool);
}

export function employeeMatchesCalendarConstructorOrganizationFilters(
  employee: Employee,
  filters: CalendarConstructorOrganizationFilters,
): boolean {
  if (filters.departmentId === 'unassigned') {
    if (employee.departmentId) {
      return false;
    }
  } else if (
    filters.departmentId !== 'all' &&
    employee.departmentId !== filters.departmentId
  ) {
    return false;
  }

  if (filters.shiftAssignment === 'unassigned') {
    return !employee.shiftAssignment;
  }

  return (
    filters.shiftAssignment === 'all' ||
    employee.shiftAssignment === filters.shiftAssignment
  );
}
