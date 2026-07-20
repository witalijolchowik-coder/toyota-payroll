import type { DailyValue, Employee, IsoDate } from '../../types/firestore';
import {
  createPayrollMonthCalendar,
  currentPayrollMonthId,
  formatPayrollMonthId,
  getPayrollMonthDateRange,
  getUiVirtualDefaultHours,
  parsePayrollMonthId,
  previousPayrollMonthId,
  type PayrollCalendarOverrideMap,
  type PayrollMonthDateRange,
  type ParsedPayrollMonth,
} from '../../utils/payroll';
import { resolveEffectiveAttendanceValue } from '../../utils/attendance';
import {
  employeeContractsOverlapRange,
  isDateCoveredByContracts,
} from '../../utils/employees';

export type ParsedMonthId = ParsedPayrollMonth;
export type MonthDateRange = PayrollMonthDateRange;

export interface CalendarDay {
  date: Date;
  isoDate: IsoDate;
  dayOfMonth: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isWorkingDay: boolean;
  isFuture: boolean;
}

export type SettlementCellKind =
  'manual' | 'imported' | 'imported-override' | 'virtual-default' | 'empty';

export type SettlementCalendarState =
  'working' | 'non-working' | 'future' | 'outside-employment';

export interface SettlementCellValue {
  kind: SettlementCellKind;
  calendarState: SettlementCalendarState;
  hours: number | null;
  fallbackHours: number | null;
  coordinatorNote: string | null;
  workTimeCorrection?: DailyValue['workTimeCorrection'] | null;
}

export const parseMonthId = parsePayrollMonthId;
export const formatMonthId = formatPayrollMonthId;
export const getMonthDateRange = getPayrollMonthDateRange;

export function currentMonthId(today = new Date()) {
  return currentPayrollMonthId(today);
}

export function previousMonthId(today = new Date()) {
  return previousPayrollMonthId(today);
}

function localDateToIsoDate(date: Date): IsoDate {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(
    date.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function utcDateToIsoDate(date: Date): IsoDate {
  return `${date.getUTCFullYear().toString().padStart(4, '0')}-${(
    date.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, '0')}-${date.getUTCDate().toString().padStart(2, '0')}`;
}

export function createCalendarDays(
  monthId: string,
  options: {
    today?: Date;
    publicHolidays?: ReadonlySet<IsoDate>;
    overrides?: PayrollCalendarOverrideMap;
  } = {},
): CalendarDay[] {
  const todayIso = localDateToIsoDate(options.today ?? new Date());
  return createPayrollMonthCalendar(monthId, options).map((day) => ({
    date: day.date,
    isoDate: day.isoDate,
    dayOfMonth: day.dayOfMonth,
    isWeekend: day.isWeekend,
    isHoliday: day.isPublicHoliday,
    isWorkingDay: day.isWorkingDay,
    isFuture: day.isoDate > todayIso,
  }));
}

export function employeeParticipatesInMonth(
  employee: Employee,
  range: MonthDateRange,
): boolean {
  return employeeContractsOverlapRange(
    employee,
    utcDateToIsoDate(range.start),
    utcDateToIsoDate(range.end),
  );
}

export function isDayWithinEmployment(
  employee: Employee,
  day: CalendarDay,
): boolean {
  return isDateCoveredByContracts(employee, day.isoDate);
}

export function resolveSettlementCellValue({
  employee,
  day,
  persistedValue,
}: {
  employee: Employee;
  day: CalendarDay;
  persistedValue?: DailyValue;
}): SettlementCellValue {
  const isWithinEmployment = isDayWithinEmployment(employee, day);
  const calendarState: SettlementCalendarState = !isWithinEmployment
    ? 'outside-employment'
    : day.isFuture
      ? 'future'
      : day.isWorkingDay
        ? 'working'
        : 'non-working';

  if (persistedValue) {
    const effective = resolveEffectiveAttendanceValue(persistedValue);
    return {
      kind: effective.kind,
      calendarState,
      hours: effective.hours,
      fallbackHours:
        persistedValue.source === 'attendance_import'
          ? persistedValue.hours
          : getUiVirtualDefaultHours({
              isWorkingDay: day.isWorkingDay,
              isWithinEmployment,
              hasGoverningValue: false,
              isFuture: day.isFuture,
            }),
      coordinatorNote: effective.kind === 'imported' ? null : effective.note,
      ...(persistedValue.workTimeCorrection
        ? { workTimeCorrection: persistedValue.workTimeCorrection }
        : {}),
    };
  }

  const virtualHours = getUiVirtualDefaultHours({
    isWorkingDay: day.isWorkingDay,
    isWithinEmployment,
    hasGoverningValue: false,
    isFuture: day.isFuture,
  });
  if (virtualHours !== null) {
    return {
      kind: 'virtual-default',
      calendarState,
      hours: virtualHours,
      fallbackHours: virtualHours,
      coordinatorNote: null,
    };
  }

  return {
    kind: 'empty',
    calendarState,
    hours: null,
    fallbackHours: null,
    coordinatorNote: null,
  };
}

export function dailyValueLookupKey(
  employeeId: string,
  isoDate: IsoDate,
): string {
  return `${employeeId}:${isoDate}`;
}
