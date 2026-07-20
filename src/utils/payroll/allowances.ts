import type { MonthId } from '../../types/firestore';

export const LAUNDRY_ALLOWANCE_MAX = 40;
export const TRANSPORT_ALLOWANCE_MAX = 275;
export const OWN_HOUSING_ALLOWANCE = 300;
export const UDT_ALLOWANCE = 300;

export type AllowancePresenceCode =
  | 'WORK'
  | 'BHP'
  | 'TRAINING'
  | 'DELEGATION'
  | 'L4'
  | 'PAID_LEAVE'
  | 'UNPAID_LEAVE'
  | 'NN'
  | 'DAY_OFF'
  | 'HOLIDAY';

const QUALIFYING_PRESENCE = new Set<AllowancePresenceCode>([
  'WORK',
  'BHP',
  'TRAINING',
  'DELEGATION',
]);

export function isQualifyingAllowancePresence(
  code: AllowancePresenceCode,
): boolean {
  return QUALIFYING_PRESENCE.has(code);
}

export function calculateAttendanceProportionalAllowance({
  maximum,
  qualifyingDays,
  nominalDays,
}: {
  maximum: number;
  qualifyingDays: number;
  nominalDays: number;
}): number {
  if (maximum <= 0 || nominalDays <= 0 || qualifyingDays <= 0) {
    return 0;
  }
  return (
    Math.round(
      Math.min(maximum, (maximum * qualifyingDays) / nominalDays) * 100,
    ) / 100
  );
}

export function calculateLaundryAllowance(
  qualifyingDays: number,
  nominalDays: number,
): number {
  return calculateAttendanceProportionalAllowance({
    maximum: LAUNDRY_ALLOWANCE_MAX,
    qualifyingDays,
    nominalDays,
  });
}

export function calculateTransportAllowance(
  qualifyingDays: number,
  nominalDays: number,
): number {
  return calculateAttendanceProportionalAllowance({
    maximum: TRANSPORT_ALLOWANCE_MAX,
    qualifyingDays,
    nominalDays,
  });
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateCompanyAccommodationCharge({
  monthStart,
  monthEnd,
  employmentStart,
  employmentEnd,
  moveInDate,
  moveOutDate,
  mediaMonthly,
  accommodationMonthly,
}: {
  monthStart: IsoDateString;
  monthEnd: IsoDateString;
  employmentStart: IsoDateString;
  employmentEnd?: IsoDateString | null;
  moveInDate: IsoDateString;
  /** First day outside company accommodation. */
  moveOutDate?: IsoDateString | null;
  mediaMonthly: number;
  accommodationMonthly: number;
}) {
  const lastAccommodationDay = moveOutDate
    ? addDays(moveOutDate, -1)
    : monthEnd;
  const start = [monthStart, employmentStart, moveInDate].sort().at(-1)!;
  const end = [
    monthEnd,
    employmentEnd ?? monthEnd,
    lastAccommodationDay,
  ].sort()[0]!;
  const monthDays = inclusiveDays(monthStart, monthEnd);
  const chargedDays = start <= end ? inclusiveDays(start, end) : 0;
  const factor = monthDays > 0 ? chargedDays / monthDays : 0;
  const media = roundMoney(mediaMonthly * factor);
  const accommodation = roundMoney(accommodationMonthly * factor);
  return {
    chargedDays,
    media,
    accommodation,
    total: roundMoney(media + accommodation),
  };
}

export interface HousingDepositResult {
  episodeId: string | null;
  held: number;
  withheld: number;
  automaticReturn: number;
  finalReturn: number;
}

export function calculateHousingDeposit({
  monthId,
  episodeId,
  episodeStart,
  episodeEnd,
  employmentEnd,
  configuredAmount,
  returnOverride = null,
}: {
  monthId: MonthId;
  episodeId: string | null;
  episodeStart: IsoDateString | null;
  episodeEnd: IsoDateString | null;
  employmentEnd: IsoDateString | null;
  configuredAmount: number | null;
  returnOverride?: number | null;
}): HousingDepositResult {
  if (!episodeId || !episodeStart || configuredAmount === null) {
    return {
      episodeId,
      held: 0,
      withheld: 0,
      automaticReturn: 0,
      finalReturn: 0,
    };
  }
  const moveInMonth = episodeStart.slice(0, 7);
  const effectiveEnd =
    episodeEnd && employmentEnd
      ? episodeEnd < employmentEnd
        ? episodeEnd
        : employmentEnd
      : (episodeEnd ?? employmentEnd);
  const returnMonth = effectiveEnd?.slice(0, 7) ?? null;
  const held = configuredAmount;
  const withheld = monthId === moveInMonth ? held : 0;
  const automaticReturn = returnMonth === monthId ? held : 0;
  const finalReturn =
    automaticReturn > 0 && returnOverride !== null
      ? Math.min(held, Math.max(0, returnOverride))
      : automaticReturn;
  return { episodeId, held, withheld, automaticReturn, finalReturn };
}

type IsoDateString = `${number}-${number}-${number}` | string;

function inclusiveDays(start: string, end: string): number {
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
