import type {
  Department,
  Employee,
  EmployeeGender,
  MedicalExaminationType,
} from '../../types/firestore';

const ISO_COUNTRY_CODES = new Set(
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  ),
);

export const MEDICAL_EXAMINATION_TYPES = [
  'PRODUKCJA',
  'MAGAZYNIER',
  'PRODUKCJA_HL_PU',
] as const satisfies readonly MedicalExaminationType[];

export type MedicalStatusIssue =
  | 'missing-data'
  | 'missing-validity'
  | 'expired'
  | 'expiring-soon'
  | 'department-mismatch';

export interface EmployeeMedicalStatus {
  primary:
    'valid' | 'missing-data' | 'missing-validity' | 'expired' | 'expiring-soon';
  issues: MedicalStatusIssue[];
  daysRemaining: number | null;
  expectedType: MedicalExaminationType | null;
}

export interface MedicalNoticeSummary {
  expired: Employee[];
  expiringSoon: Employee[];
  missingValidity: Employee[];
  incompatible: Employee[];
}

export function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCitizenship(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return ISO_COUNTRY_CODES.has(normalized) ? normalized : null;
}

export function isValidCitizenship(value: string): boolean {
  return normalizeCitizenship(value) !== null;
}

export function normalizeEmployeeGender(value: string): EmployeeGender | null {
  const normalized = normalizeComparable(value);
  if (['K', 'KOBIETA', 'F', 'FEMALE'].includes(normalized)) {
    return 'K';
  }
  if (['M', 'MEZCZYZNA', 'MALE'].includes(normalized)) {
    return 'M';
  }
  return null;
}

export function normalizeMedicalExaminationType(
  value: string,
): MedicalExaminationType | null {
  const normalized = normalizeComparable(value).replaceAll(' ', '_');
  const aliases: Record<string, MedicalExaminationType> = {
    PRODUKCJA: 'PRODUKCJA',
    PRACOWNIK_PRODUKCJI: 'PRODUKCJA',
    MAGAZYNIER: 'MAGAZYNIER',
    PRODUKCJA_HL_PU: 'PRODUKCJA_HL_PU',
    PRACOWNIK_PRODUKCJI_HL_PU: 'PRODUKCJA_HL_PU',
  };
  return aliases[normalized] ?? null;
}

export function expectedMedicalTypeForDepartment(
  departmentName: string | null | undefined,
): MedicalExaminationType | null {
  const normalized = normalizeComparable(departmentName ?? '');
  if (['METAL', 'MONTAZ', 'SZWALNIA'].includes(normalized)) {
    return 'PRODUKCJA';
  }
  if (normalized === 'MAGAZYN') {
    return 'MAGAZYNIER';
  }
  if (['HEADLINER', 'PU'].includes(normalized)) {
    return 'PRODUKCJA_HL_PU';
  }
  return null;
}

export function deriveEmployeeMedicalStatus(
  employee: Pick<
    Employee,
    'medicalExaminationDate' | 'medicalValidUntil' | 'medicalExaminationType'
  >,
  departmentName: string | null | undefined,
  today = new Date(),
): EmployeeMedicalStatus {
  const expectedType = expectedMedicalTypeForDepartment(departmentName);
  const issues: MedicalStatusIssue[] = [];
  const hasCoreData = Boolean(
    employee.medicalExaminationDate && employee.medicalExaminationType,
  );

  if (!hasCoreData) {
    issues.push('missing-data');
  }

  let daysRemaining: number | null = null;
  if (!employee.medicalValidUntil) {
    issues.push('missing-validity');
  } else {
    daysRemaining = differenceInCalendarDays(employee.medicalValidUntil, today);
    if (daysRemaining < 0) {
      issues.push('expired');
    } else if (daysRemaining <= 10) {
      issues.push('expiring-soon');
    }
  }

  if (
    expectedType &&
    employee.medicalExaminationType &&
    expectedType !== employee.medicalExaminationType
  ) {
    issues.push('department-mismatch');
  }

  const primary = issues.includes('expired')
    ? 'expired'
    : issues.includes('expiring-soon')
      ? 'expiring-soon'
      : issues.includes('missing-validity')
        ? 'missing-validity'
        : issues.includes('missing-data')
          ? 'missing-data'
          : 'valid';

  return { primary, issues, daysRemaining, expectedType };
}

export function aggregateMedicalNotices(
  employees: readonly Employee[],
  departments: readonly Department[],
  today = new Date(),
): MedicalNoticeSummary {
  const departmentsById = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const summary: MedicalNoticeSummary = {
    expired: [],
    expiringSoon: [],
    missingValidity: [],
    incompatible: [],
  };

  employees
    .filter((employee) => employee.isActive)
    .forEach((employee) => {
      const status = deriveEmployeeMedicalStatus(
        employee,
        employee.departmentId
          ? departmentsById.get(employee.departmentId)
          : null,
        today,
      );
      if (status.issues.includes('expired')) summary.expired.push(employee);
      if (status.issues.includes('expiring-soon'))
        summary.expiringSoon.push(employee);
      if (status.issues.includes('missing-validity'))
        summary.missingValidity.push(employee);
      if (status.issues.includes('department-mismatch'))
        summary.incompatible.push(employee);
    });

  return summary;
}

function normalizeComparable(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function differenceInCalendarDays(value: Date, today: Date): number {
  const day = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
  const current = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((day - current) / 86_400_000);
}
