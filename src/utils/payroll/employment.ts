import type { IsoDate } from '../../types/firestore';
import {
  createPayrollMonthCalendar,
  STANDARD_WORKING_DAY_HOURS,
  type PayrollCalendarOptions,
} from './calendar';
import {
  dateToIsoDate,
  getPayrollMonthDateRange,
  type PayrollMonthDateRange,
} from './month';

export interface EmploymentPeriod {
  employmentStart: Date | null;
  employmentEnd: Date | null;
}

export function employeeParticipatesInPayrollMonth(
  employment: EmploymentPeriod,
  range: PayrollMonthDateRange,
): boolean {
  if (!employment.employmentStart) {
    return false;
  }

  return (
    employment.employmentStart <= range.end &&
    (!employment.employmentEnd || employment.employmentEnd >= range.start)
  );
}

export function isDateWithinEmploymentPeriod(
  isoDate: IsoDate,
  employment: EmploymentPeriod,
): boolean {
  if (!employment.employmentStart) {
    return false;
  }

  const startDate = dateToIsoDate(employment.employmentStart);
  const endDate = employment.employmentEnd
    ? dateToIsoDate(employment.employmentEnd)
    : null;

  return isoDate >= startDate && (!endDate || isoDate <= endDate);
}

export function calculateEmployeeNominalHours(
  monthId: string,
  employment: EmploymentPeriod,
  calendarOptions: PayrollCalendarOptions = {},
): number {
  const range = getPayrollMonthDateRange(monthId);
  if (!employeeParticipatesInPayrollMonth(employment, range)) {
    return 0;
  }

  return (
    createPayrollMonthCalendar(monthId, calendarOptions).filter(
      (day) =>
        day.isWorkingDay &&
        isDateWithinEmploymentPeriod(day.isoDate, employment),
    ).length * STANDARD_WORKING_DAY_HOURS
  );
}
