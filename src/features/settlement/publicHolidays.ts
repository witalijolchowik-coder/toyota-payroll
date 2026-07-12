import type { IsoDate } from '../../types/firestore';

export interface PublicHoliday {
  date: IsoDate;
  name: string;
}

const fixedPublicHolidays = [
  { month: 1, day: 1, name: 'Nowy Rok' },
  { month: 1, day: 6, name: 'Święto Trzech Króli' },
  { month: 5, day: 1, name: 'Święto Pracy' },
  { month: 5, day: 3, name: 'Święto Konstytucji 3 Maja' },
  { month: 8, day: 15, name: 'Wniebowzięcie Najświętszej Maryi Panny' },
  { month: 11, day: 1, name: 'Wszystkich Świętych' },
  { month: 11, day: 11, name: 'Narodowe Święto Niepodległości' },
  { month: 12, day: 25, name: 'Boże Narodzenie' },
  { month: 12, day: 26, name: 'Drugi dzień Bożego Narodzenia' },
] as const;

export function getPolishPublicHolidaysForYear(
  year: number,
): readonly PublicHoliday[] {
  const easter = getEasterSundayUtc(year);
  const holidays: PublicHoliday[] = fixedPublicHolidays.map((holiday) => ({
    date: isoDateFromParts(year, holiday.month, holiday.day),
    name: holiday.name,
  }));

  holidays.push(
    {
      date: isoDateFromDate(addUtcDays(easter, 1)),
      name: 'Poniedziałek Wielkanocny',
    },
    {
      date: isoDateFromDate(addUtcDays(easter, 60)),
      name: 'Boże Ciało',
    },
  );

  return holidays.sort((first, second) =>
    first.date.localeCompare(second.date),
  );
}

export function getPublicHolidaysForYear(year: number): ReadonlySet<IsoDate> {
  return new Set(
    getPolishPublicHolidaysForYear(year).map((holiday) => holiday.date),
  );
}

export function getPublicHolidayNamesForYear(
  year: number,
): ReadonlyMap<IsoDate, string> {
  return new Map(
    getPolishPublicHolidaysForYear(year).map((holiday) => [
      holiday.date,
      holiday.name,
    ]),
  );
}

function isoDateFromParts(year: number, month: number, day: number): IsoDate {
  return isoDateFromDate(new Date(Date.UTC(year, month - 1, day)));
}

function isoDateFromDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getEasterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}
