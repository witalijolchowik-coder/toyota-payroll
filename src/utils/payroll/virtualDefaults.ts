import { STANDARD_WORKING_DAY_HOURS } from './calendar';

export interface VirtualDefaultContext {
  isWorkingDay: boolean;
  isWithinEmployment: boolean;
  hasGoverningValue: boolean;
}

export interface UiVirtualDefaultContext extends VirtualDefaultContext {
  isFuture: boolean;
}

export function virtualWorkedHoursDefaultApplies({
  isWorkingDay,
  isWithinEmployment,
  hasGoverningValue,
}: VirtualDefaultContext): boolean {
  return isWorkingDay && isWithinEmployment && !hasGoverningValue;
}

export function getPayrollVirtualDefaultHours(
  context: VirtualDefaultContext,
): number | null {
  return virtualWorkedHoursDefaultApplies(context)
    ? STANDARD_WORKING_DAY_HOURS
    : null;
}

export function getUiVirtualDefaultHours({
  isWorkingDay,
  isWithinEmployment,
  hasGoverningValue,
  isFuture,
}: UiVirtualDefaultContext): number | null {
  if (!isWithinEmployment || hasGoverningValue || isFuture) {
    return null;
  }

  return isWorkingDay ? STANDARD_WORKING_DAY_HOURS : 0;
}
