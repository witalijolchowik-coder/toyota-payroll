import type { DailyValue, Employee, IsoDate } from '../../types/firestore';
import {
  createPayrollMonthCalendar,
  currentPayrollMonthId,
  employeeParticipatesInPayrollMonth,
  formatPayrollMonthId,
  getPayrollMonthDateRange,
  getUiVirtualDefaultHours,
  isDateWithinEmploymentPeriod,
  parsePayrollMonthId,
  previousPayrollMonthId,
  type PayrollCalendarOverrideMap,
  type PayrollMonthDateRange,
  type ParsedPayrollMonth,
} from '../../utils/payroll';

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
  'manual' | 'imported' | 'virtual-default' | 'empty';

export type SettlementCalendarState =
  'working' | 'non-working' | 'future' | 'outside-employment';

export interface SettlementCellValue {
  kind: SettlementCellKind;
  calendarState: SettlementCalendarState;
  hours: number | null;
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
  return employeeParticipatesInPayrollMonth(
    {
      employmentStart: employee.employmentStartDate,
      employmentEnd: employee.employmentEndDate,
    },
    range,
  );
}

export function isDayWithinEmployment(
  employee: Employee,
  day: CalendarDay,
): boolean {
  return isDateWithinEmploymentPeriod(day.isoDate, {
    employmentStart: employee.employmentStartDate,
    employmentEnd: employee.employmentEndDate,
  });
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
    return {
      kind: persistedValue.source === 'manual' ? 'manual' : 'imported',
      calendarState,
      hours: persistedValue.hours,
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
    };
  }

  return { kind: 'empty', calendarState, hours: null };
}

export function dailyValueLookupKey(
  employeeId: string,
  isoDate: IsoDate,
): string {
  return `${employeeId}:${isoDate}`;
}
