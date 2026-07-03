import type {
  DailyValue,
  Employee,
  IsoDate,
  MonthId,
} from '../../types/firestore';

const MONTH_ID_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface ParsedMonthId {
  year: number;
  month: number;
}

export interface MonthDateRange extends ParsedMonthId {
  monthId: MonthId;
  start: Date;
  end: Date;
}

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

export function parseMonthId(monthId: string): ParsedMonthId {
  const match = MONTH_ID_PATTERN.exec(monthId);
  if (!match) {
    throw new Error('monthId must use the YYYY-MM format.');
  }

  const year = Number(match[1]);
  if (year < 1) {
    throw new Error('monthId year must be greater than zero.');
  }

  return {
    year,
    month: Number(match[2]),
  };
}

export function formatMonthId(year: number, month: number): MonthId {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('year and month must form a valid payroll month.');
  }

  return `${year.toString().padStart(4, '0')}-${month
    .toString()
    .padStart(2, '0')}`;
}

export function currentMonthId(today = new Date()): MonthId {
  return formatMonthId(today.getFullYear(), today.getMonth() + 1);
}

export function previousMonthId(today = new Date()): MonthId {
  const previousMonth = new Date(today);
  previousMonth.setDate(1);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  return currentMonthId(previousMonth);
}

export function getMonthDateRange(monthId: string): MonthDateRange {
  const { year, month } = parseMonthId(monthId);
  const start = new Date(0);
  start.setUTCFullYear(year, month - 1, 1);
  start.setUTCHours(0, 0, 0, 0);
  const nextMonthStart = new Date(start);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

  return {
    monthId,
    year,
    month,
    start,
    end: new Date(nextMonthStart.getTime() - 1),
  };
}

export function dateToIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
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
  } = {},
): CalendarDay[] {
  const range = getMonthDateRange(monthId);
  const todayIso = localDateToIsoDate(options.today ?? new Date());
  const publicHolidays = options.publicHolidays ?? new Set<IsoDate>();
  const daysInMonth = range.end.getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(range.start);
    date.setUTCDate(index + 1);
    const isoDate = dateToIsoDate(date);
    const weekday = date.getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = publicHolidays.has(isoDate);

    return {
      date,
      isoDate,
      dayOfMonth: index + 1,
      isWeekend,
      isHoliday,
      isWorkingDay: !isWeekend && !isHoliday,
      isFuture: isoDate > todayIso,
    };
  });
}

export function employeeParticipatesInMonth(
  employee: Employee,
  range: MonthDateRange,
): boolean {
  if (!employee.employmentStartDate) {
    return false;
  }

  return (
    employee.employmentStartDate <= range.end &&
    (!employee.employmentEndDate || employee.employmentEndDate >= range.start)
  );
}

export function isDayWithinEmployment(
  employee: Employee,
  day: CalendarDay,
): boolean {
  const dayStart = day.date.getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

  return Boolean(
    employee.employmentStartDate &&
    employee.employmentStartDate.getTime() <= dayEnd &&
    (!employee.employmentEndDate ||
      employee.employmentEndDate.getTime() >= dayStart),
  );
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
  const calendarState: SettlementCalendarState = !isDayWithinEmployment(
    employee,
    day,
  )
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

  if (calendarState === 'working' || calendarState === 'non-working') {
    return {
      kind: 'virtual-default',
      calendarState,
      hours: calendarState === 'working' ? 8 : 0,
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
