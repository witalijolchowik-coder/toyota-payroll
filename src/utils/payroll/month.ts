import type { IsoDate, MonthId } from '../../types/firestore';

const MONTH_ID_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface ParsedPayrollMonth {
  year: number;
  month: number;
}

export interface PayrollMonthDateRange extends ParsedPayrollMonth {
  monthId: MonthId;
  start: Date;
  end: Date;
}

export function parsePayrollMonthId(monthId: string): ParsedPayrollMonth {
  const match = MONTH_ID_PATTERN.exec(monthId);
  if (!match) {
    throw new Error('monthId must use the YYYY-MM format.');
  }

  const year = Number(match[1]);
  if (year < 1) {
    throw new Error('monthId year must be greater than zero.');
  }

  return { year, month: Number(match[2]) };
}

export function formatPayrollMonthId(year: number, month: number): MonthId {
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

export function currentPayrollMonthId(today: Date): MonthId {
  return formatPayrollMonthId(today.getFullYear(), today.getMonth() + 1);
}

export function previousPayrollMonthId(today: Date): MonthId {
  const previousMonth = new Date(today);
  previousMonth.setDate(1);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  return currentPayrollMonthId(previousMonth);
}

export function getPayrollMonthDateRange(
  monthId: string,
): PayrollMonthDateRange {
  const { year, month } = parsePayrollMonthId(monthId);
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

export function listPayrollMonthDates(monthId: string): Date[] {
  const range = getPayrollMonthDateRange(monthId);
  const daysInMonth = range.end.getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(range.start);
    date.setUTCDate(index + 1);
    return date;
  });
}
