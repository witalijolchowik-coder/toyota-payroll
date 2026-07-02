import type { IsoDate } from '../../types/firestore';

const noConfiguredPublicHolidays = new Set<IsoDate>();

export function getPublicHolidaysForYear(year: number): ReadonlySet<IsoDate> {
  void year;
  return noConfiguredPublicHolidays;
}
