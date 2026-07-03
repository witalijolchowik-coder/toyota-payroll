import type { IsoDate } from '../../types/firestore';
import { dateToIsoDate, listPayrollMonthDates } from './month';

export const STANDARD_WORKING_DAY_HOURS = 8;

export type PayrollDayClassification = 'working' | 'non-working';
export type PayrollCalendarOverrideMap = ReadonlyMap<
  IsoDate,
  PayrollDayClassification
>;

export interface PayrollCalendarOptions {
  publicHolidays?: ReadonlySet<IsoDate>;
  overrides?: PayrollCalendarOverrideMap;
}

export interface PayrollCalendarDay {
  date: Date;
  isoDate: IsoDate;
  dayOfMonth: number;
  isWeekend: boolean;
  isPublicHoliday: boolean;
  override: PayrollDayClassification | null;
  classification: PayrollDayClassification;
  isWorkingDay: boolean;
}

export function isWeekend(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function classifyPayrollDate(
  date: Date,
  options: PayrollCalendarOptions = {},
): PayrollDayClassification {
  const isoDate = dateToIsoDate(date);
  const override = options.overrides?.get(isoDate);
  if (override) {
    return override;
  }

  if (isWeekend(date) || options.publicHolidays?.has(isoDate)) {
    return 'non-working';
  }

  return 'working';
}

export function isPayrollWorkingDay(
  date: Date,
  options: PayrollCalendarOptions = {},
): boolean {
  return classifyPayrollDate(date, options) === 'working';
}

export function createPayrollMonthCalendar(
  monthId: string,
  options: PayrollCalendarOptions = {},
): PayrollCalendarDay[] {
  return listPayrollMonthDates(monthId).map((date) => {
    const isoDate = dateToIsoDate(date);
    const override = options.overrides?.get(isoDate) ?? null;
    const classification = classifyPayrollDate(date, options);

    return {
      date,
      isoDate,
      dayOfMonth: date.getUTCDate(),
      isWeekend: isWeekend(date),
      isPublicHoliday: options.publicHolidays?.has(isoDate) ?? false,
      override,
      classification,
      isWorkingDay: classification === 'working',
    };
  });
}

export function calculateMonthNominalHours(
  monthId: string,
  options: PayrollCalendarOptions = {},
): number {
  const workingDays = createPayrollMonthCalendar(monthId, options).filter(
    (day) => day.isWorkingDay,
  ).length;

  return workingDays * STANDARD_WORKING_DAY_HOURS;
}
