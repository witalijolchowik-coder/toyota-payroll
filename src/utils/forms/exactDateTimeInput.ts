const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
const CLOCK_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const candidate = new Date(0);
  candidate.setFullYear(year, month - 1, day);
  candidate.setHours(0, 0, 0, 0);

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDateParts(
  year: number,
  month: number,
  day: number,
): string | null {
  return isValidDateParts(year, month, day)
    ? formatIsoDate(year, month, day)
    : null;
}

/**
 * Normalizes an exact date to the application's ISO date representation.
 * Four digits are deliberately reserved for the agreed DDMM shorthand.
 */
export function normalizeExactDateInput(
  input: string,
  currentYear = new Date().getFullYear(),
): string | null {
  const value = input.trim();
  const isoMatch = ISO_DATE_PATTERN.exec(value);
  if (isoMatch) {
    return normalizeDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    );
  }

  const localMatch = LOCAL_DATE_PATTERN.exec(value);
  if (localMatch) {
    return normalizeDateParts(
      Number(localMatch[3]),
      Number(localMatch[2]),
      Number(localMatch[1]),
    );
  }

  if (/^\d{4}$/.test(value)) {
    return normalizeDateParts(
      currentYear,
      Number(value.slice(2)),
      Number(value.slice(0, 2)),
    );
  }

  return null;
}

export function formatExactDateForDisplay(value: string): string {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match || normalizeExactDateInput(value) === null) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function isCanonicalExactDate(value: string): boolean {
  return (
    ISO_DATE_PATTERN.test(value) && normalizeExactDateInput(value) === value
  );
}

function normalizeClockParts(hours: number, minutes: number): string | null {
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Normalizes exact clock time. Three-digit values are rejected rather than
 * guessed, while one/two digits mean a full hour and four digits mean HHmm.
 */
export function normalizeExactTimeInput(input: string): string | null {
  const value = input.trim();
  const standardMatch = CLOCK_TIME_PATTERN.exec(value);
  if (standardMatch) {
    return normalizeClockParts(
      Number(standardMatch[1]),
      Number(standardMatch[2]),
    );
  }

  if (/^\d{1,2}$/.test(value)) {
    return normalizeClockParts(Number(value), 0);
  }

  if (/^\d{4}$/.test(value)) {
    return normalizeClockParts(
      Number(value.slice(0, 2)),
      Number(value.slice(2)),
    );
  }

  return null;
}

export function isCanonicalExactTime(value: string): boolean {
  return normalizeExactTimeInput(value) === value;
}
