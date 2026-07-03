import type { IsoDate } from '../../types/firestore';
import type { EmploymentPeriod } from '../payroll';
import { dateToIsoDate } from '../payroll';

export const ABSENCE_CODES = [
  'L4',
  'UW',
  'UZ',
  'NN',
  'NU',
  'NI',
  'OPD',
  'KRW',
  'WZN',
] as const;

export type AbsenceCode = (typeof ABSENCE_CODES)[number];

export const EXCUSED_ABSENCE_CODES = new Set<string>([
  'UW',
  'UZ',
  'OPD',
  'KRW',
  'WZN',
]);

export const UNEXPLAINED_ABSENCE_CODES = new Set<string>(['NN', 'NU', 'NI']);

export interface AbsenceRuleRecord {
  id: string;
  employeeId: string;
  absenceCode: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: 'ACTIVE' | 'CANCELLED';
}

export type AbsenceValidationCode =
  | 'required'
  | 'unsupported-code'
  | 'invalid-date'
  | 'invalid-range'
  | 'ownership-month-change';

export interface AbsenceValidationErrors {
  employeeId?: AbsenceValidationCode;
  absenceCode?: AbsenceValidationCode;
  startDate?: AbsenceValidationCode;
  endDate?: AbsenceValidationCode;
}

export interface AbsenceInputValues {
  employeeId: string;
  absenceCode: string;
  startDate: string;
  endDate: string;
}

export type GoverningAbsenceResolution =
  | { kind: 'none'; code: null; records: [] }
  | {
      kind: 'governed';
      code: string;
      records: AbsenceRuleRecord[];
      overriddenRecords: AbsenceRuleRecord[];
    }
  | {
      kind: 'ambiguous';
      code: null;
      records: AbsenceRuleRecord[];
      codes: string[];
    };

export type AbsenceEmploymentIssue =
  'missing-employment-start' | 'outside-employment' | null;

const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function normalizeAbsenceCode(value: string): string {
  return value.trim().toLocaleUpperCase('pl-PL').replace('UŻ', 'UZ');
}

export function isSupportedAbsenceCode(value: string): value is AbsenceCode {
  return ABSENCE_CODES.includes(normalizeAbsenceCode(value) as AbsenceCode);
}

export function isValidIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validateAbsenceInput(
  input: AbsenceInputValues,
  ownerMonthId?: string,
): AbsenceValidationErrors {
  const errors: AbsenceValidationErrors = {};
  const code = normalizeAbsenceCode(input.absenceCode);

  if (!input.employeeId.trim()) {
    errors.employeeId = 'required';
  }
  if (!code) {
    errors.absenceCode = 'required';
  } else if (!isSupportedAbsenceCode(code)) {
    errors.absenceCode = 'unsupported-code';
  }
  if (!isValidIsoDate(input.startDate)) {
    errors.startDate = input.startDate ? 'invalid-date' : 'required';
  }
  if (!isValidIsoDate(input.endDate)) {
    errors.endDate = input.endDate ? 'invalid-date' : 'required';
  }
  if (!errors.startDate && !errors.endDate && input.endDate < input.startDate) {
    errors.endDate = 'invalid-range';
  }
  if (
    ownerMonthId &&
    !errors.startDate &&
    input.startDate.slice(0, 7) !== ownerMonthId
  ) {
    errors.startDate = 'ownership-month-change';
  }

  return errors;
}

export function absenceRangesOverlap(
  first: Pick<AbsenceRuleRecord, 'startDate' | 'endDate'>,
  second: Pick<AbsenceRuleRecord, 'startDate' | 'endDate'>,
): boolean {
  return first.startDate <= second.endDate && first.endDate >= second.startDate;
}

export function absenceCoversDate(
  absence: Pick<AbsenceRuleRecord, 'startDate' | 'endDate'>,
  date: IsoDate,
): boolean {
  return absence.startDate <= date && absence.endDate >= date;
}

export function findBlockingL4(
  existing: readonly AbsenceRuleRecord[],
  candidate: Pick<
    AbsenceRuleRecord,
    'employeeId' | 'absenceCode' | 'startDate' | 'endDate'
  >,
  ignoredAbsenceId?: string,
): AbsenceRuleRecord | null {
  if (normalizeAbsenceCode(candidate.absenceCode) === 'L4') {
    return null;
  }

  return (
    existing.find(
      (absence) =>
        absence.id !== ignoredAbsenceId &&
        absence.employeeId === candidate.employeeId &&
        absence.status === 'ACTIVE' &&
        normalizeAbsenceCode(absence.absenceCode) === 'L4' &&
        absenceRangesOverlap(absence, candidate),
    ) ?? null
  );
}

export function resolveGoverningAbsence(
  absences: readonly AbsenceRuleRecord[],
  date: IsoDate,
): GoverningAbsenceResolution {
  const active = absences.filter(
    (absence) =>
      absence.status === 'ACTIVE' && absenceCoversDate(absence, date),
  );
  if (active.length === 0) {
    return { kind: 'none', code: null, records: [] };
  }

  const l4 = active.filter(
    (absence) => normalizeAbsenceCode(absence.absenceCode) === 'L4',
  );
  if (l4.length > 0) {
    return {
      kind: 'governed',
      code: 'L4',
      records: l4,
      overriddenRecords: active.filter((absence) => !l4.includes(absence)),
    };
  }

  const codes = [
    ...new Set(
      active.map((absence) => normalizeAbsenceCode(absence.absenceCode)),
    ),
  ];
  if (codes.length === 1) {
    return {
      kind: 'governed',
      code: codes[0]!,
      records: active,
      overriddenRecords: [],
    };
  }

  return { kind: 'ambiguous', code: null, records: active, codes };
}

export function absenceEmploymentIssue(
  absence: Pick<AbsenceRuleRecord, 'startDate' | 'endDate'>,
  employment: EmploymentPeriod,
): AbsenceEmploymentIssue {
  if (!employment.employmentStart) {
    return 'missing-employment-start';
  }

  const employmentStart = dateToIsoDate(employment.employmentStart);
  const employmentEnd = employment.employmentEnd
    ? dateToIsoDate(employment.employmentEnd)
    : null;
  return absence.startDate < employmentStart ||
    Boolean(employmentEnd && absence.endDate > employmentEnd)
    ? 'outside-employment'
    : null;
}

export function absenceRemovesVirtualDefault(
  resolution: GoverningAbsenceResolution,
): boolean {
  return resolution.kind !== 'none';
}
