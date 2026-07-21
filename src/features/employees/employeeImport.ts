import type {
  Department,
  Employee,
  EmployeeCreateInput,
  PayrollSetting,
} from '../../types/firestore';
import { resolveCanonicalDepartment } from '../../utils/organization';
import { normalizeTetaNumber } from './employeeValidation';

export type EmployeeImportSource = 'toyota' | 'soz-pl' | 'soz-ua';

export type EmployeeImportStatus =
  'new' | 'existing' | 'duplicate' | 'conflict' | 'blocked';

export type EmployeeImportWarningCode =
  | 'missing-name'
  | 'missing-teta'
  | 'missing-employment-start'
  | 'duplicate-teta-in-import'
  | 'existing-employee'
  | 'identity-conflict'
  | 'soz-unmatched'
  | 'soz-ambiguous-match'
  | 'department-na0'
  | 'department-unmapped'
  | 'company-housing-variant-required'
  | 'own-housing-detected';

export interface ToyotaEmployeeImportRow {
  source: 'toyota';
  rowNumber: number;
  firstName: string;
  lastName: string;
  tetaNumber: string;
  departmentName: string;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
}

export interface SozEmployeeImportRow {
  source: 'soz-pl' | 'soz-ua';
  rowNumber: number;
  firstName: string;
  lastName: string;
  identityNumber: string;
  companyHousingMediaAmount: number;
  companyHousingAccommodationAmount: number;
  ownHousingAllowanceAmount: number;
}

export interface EmployeeImportPreviewRow {
  id: string;
  status: EmployeeImportStatus;
  source: EmployeeImportSource;
  rowNumber: number;
  firstName: string;
  lastName: string;
  tetaNumber: string;
  pesel: string | null;
  passportNumber: string | null;
  foreignDocumentNumber: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  sourceDepartmentName: string;
  departmentId: string | null;
  departmentName: string | null;
  companyHousingMediaAmount: number;
  companyHousingAccommodationAmount: number;
  ownHousingAllowanceAmount: number;
  warnings: EmployeeImportWarningCode[];
  createInput: EmployeeCreateInput | null;
}

export interface BuildEmployeeImportPreviewInput {
  toyotaRows: ToyotaEmployeeImportRow[];
  sozRows: SozEmployeeImportRow[];
  existingEmployees: readonly Employee[];
  departments: readonly Department[];
  accommodationVariants: readonly PayrollSetting[];
}

interface CsvRow {
  rowNumber: number;
  headers: string[];
  values: string[];
}

export function normalizeImportText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeImportKey(value: unknown): string {
  return normalizeImportText(value)
    .toLocaleLowerCase('pl-PL')
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeIdentityNumber(value: unknown): string {
  return normalizeImportText(value)
    .toLocaleUpperCase('pl-PL')
    .replace(/[^A-Z0-9]/g, '');
}

export function personNameKey(firstName: string, lastName: string): string {
  return `${normalizeImportKey(lastName)}|${normalizeImportKey(firstName)}`;
}

export function parseImportedDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return dateOnly(value);
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const utcDays = Math.floor(value - 25569);
    return new Date(Date.UTC(1970, 0, 1 + utcDays));
  }

  const text = normalizeImportText(value);
  if (!text) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    return new Date(
      Date.UTC(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3]),
      ),
    );
  }

  const polishMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text);
  if (polishMatch) {
    return new Date(
      Date.UTC(
        Number(polishMatch[3]),
        Number(polishMatch[2]) - 1,
        Number(polishMatch[1]),
      ),
    );
  }

  return null;
}

export function formatImportDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

export function parsePolishAmount(value: unknown): number {
  const text = normalizeImportText(value).replace(/\s/g, '');
  if (!text) {
    return 0;
  }
  const normalized = text.replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseToyotaEmployeeRowsFromMatrix(
  rows: readonly (readonly unknown[])[],
): ToyotaEmployeeImportRow[] {
  if (rows.length === 0) {
    return [];
  }

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeImportKey(cell) === 'numerpersonalny'),
  );
  if (headerRowIndex < 0) {
    return [];
  }

  const headers = rows[headerRowIndex].map((cell) => normalizeImportKey(cell));
  const findIndex = (name: string) => headers.indexOf(normalizeImportKey(name));
  const lastNameIndex = findIndex('Nazwisko');
  const firstNameIndex = findIndex('Imię');
  const tetaIndex = findIndex('Numer personalny');
  const departmentIndex = findIndex('Jednostka organizacyjna/Dział');
  const startIndex = findIndex('Data zatrudnienia');
  const endIndex = findIndex('Data zwolnienia');

  return rows
    .slice(headerRowIndex + 1)
    .map((row, offset) => ({
      source: 'toyota' as const,
      rowNumber: headerRowIndex + offset + 2,
      firstName: normalizeImportText(row[firstNameIndex]),
      lastName: normalizeImportText(row[lastNameIndex]),
      tetaNumber: normalizeTetaNumber(normalizeImportText(row[tetaIndex])),
      departmentName: normalizeImportText(row[departmentIndex]),
      contractStartDate: parseImportedDate(row[startIndex]),
      contractEndDate: parseImportedDate(row[endIndex]),
    }))
    .filter((row) => row.firstName || row.lastName || row.tetaNumber);
}

export function parseSozRowsFromCsv(
  csvText: string,
  source: 'soz-pl' | 'soz-ua',
): SozEmployeeImportRow[] {
  const matrix = parseSemicolonCsv(csvText);
  if (matrix.length === 0) {
    return [];
  }

  const headers = matrix[0].map((cell) => cell.replace(/^\uFEFF/, ''));
  const normalizedHeaders = headers.map((header) => normalizeImportKey(header));
  const findIndex = (name: string) =>
    normalizedHeaders.indexOf(normalizeImportKey(name));
  const lastNameIndex = findIndex('Nazwisko');
  const firstNameIndex = findIndex('Imię');
  const identityIndex = findIndex('Paszport / PESEL');

  return matrix
    .slice(1)
    .map((values, index) =>
      parseSozCsvRow(
        {
          rowNumber: index + 2,
          headers,
          values,
        },
        source,
        firstNameIndex,
        lastNameIndex,
        identityIndex,
      ),
    )
    .filter((row) => row.firstName || row.lastName || row.identityNumber);
}

export function buildEmployeeImportPreview({
  toyotaRows,
  sozRows,
  existingEmployees,
  departments,
  accommodationVariants,
}: BuildEmployeeImportPreviewInput): EmployeeImportPreviewRow[] {
  const toyotaRowsByName = groupBy(toyotaRows, (row) =>
    personNameKey(row.firstName, row.lastName),
  );
  const sozRowsByToyotaRow = new Map<number, SozEmployeeImportRow[]>();
  const unmatchedSozRows: SozEmployeeImportRow[] = [];
  const ambiguousSozNames = new Set<string>();

  sozRows.forEach((sozRow) => {
    const nameKey = personNameKey(sozRow.firstName, sozRow.lastName);
    const matchingToyotaRows = toyotaRowsByName.get(nameKey) ?? [];
    if (matchingToyotaRows.length === 1) {
      const rowNumber = matchingToyotaRows[0].rowNumber;
      sozRowsByToyotaRow.set(rowNumber, [
        ...(sozRowsByToyotaRow.get(rowNumber) ?? []),
        sozRow,
      ]);
      return;
    }
    if (matchingToyotaRows.length > 1) {
      ambiguousSozNames.add(nameKey);
    }
    unmatchedSozRows.push(sozRow);
  });

  const duplicateTetaNumbers = findDuplicateTetaNumbers(toyotaRows);
  const existingByTeta = new Map(
    existingEmployees.map((employee) => [
      normalizeTetaNumber(employee.tetaNumber),
      employee,
    ]),
  );
  const existingByIdentity = buildExistingIdentityMap(existingEmployees);

  const previewRows = toyotaRows.map((toyotaRow) => {
    const matchedSozRows = sozRowsByToyotaRow.get(toyotaRow.rowNumber) ?? [];
    const mergedIdentity = pickFirstIdentity(matchedSozRows);
    const warnings: EmployeeImportWarningCode[] = [];

    if (!toyotaRow.firstName || !toyotaRow.lastName) {
      warnings.push('missing-name');
    }
    if (!toyotaRow.tetaNumber) {
      warnings.push('missing-teta');
    }
    if (!toyotaRow.contractStartDate) {
      warnings.push('missing-employment-start');
    }
    if (duplicateTetaNumbers.has(normalizeTetaNumber(toyotaRow.tetaNumber))) {
      warnings.push('duplicate-teta-in-import');
    }

    const existingByCurrentTeta = existingByTeta.get(
      normalizeTetaNumber(toyotaRow.tetaNumber),
    );
    if (existingByCurrentTeta) {
      warnings.push('existing-employee');
    }

    const identityConflict = findIdentityConflict(
      existingByIdentity,
      mergedIdentity,
      toyotaRow.tetaNumber,
    );
    if (identityConflict) {
      warnings.push('identity-conflict');
    }

    if (
      ambiguousSozNames.has(
        personNameKey(toyotaRow.firstName, toyotaRow.lastName),
      )
    ) {
      warnings.push('soz-ambiguous-match');
    }

    const departmentMatch = resolveDepartment(
      toyotaRow.departmentName,
      departments,
    );
    if (departmentMatch.warning) {
      warnings.push(departmentMatch.warning);
    }

    const housing = summarizeHousing(matchedSozRows);
    const hasCompanyHousing =
      housing.companyHousingAccommodationAmount > 0 ||
      housing.companyHousingMediaAmount > 0;
    if (hasCompanyHousing && accommodationVariants.length === 0) {
      warnings.push('company-housing-variant-required');
    }
    if (housing.ownHousingAllowanceAmount > 0) {
      warnings.push('own-housing-detected');
    }

    const status = resolveStatus(warnings);
    const createInput =
      status === 'new'
        ? buildCreateInput(toyotaRow, mergedIdentity, departmentMatch.id)
        : null;

    return {
      id: `toyota-${toyotaRow.rowNumber}`,
      status,
      source: 'toyota' as const,
      rowNumber: toyotaRow.rowNumber,
      firstName: toyotaRow.firstName,
      lastName: toyotaRow.lastName,
      tetaNumber: toyotaRow.tetaNumber,
      pesel: mergedIdentity.pesel,
      passportNumber: mergedIdentity.passportNumber,
      foreignDocumentNumber: mergedIdentity.foreignDocumentNumber,
      contractStartDate: toyotaRow.contractStartDate,
      contractEndDate: toyotaRow.contractEndDate,
      sourceDepartmentName: toyotaRow.departmentName,
      departmentId: departmentMatch.id,
      departmentName: departmentMatch.name,
      ...housing,
      warnings,
      createInput,
    };
  });

  return [
    ...previewRows,
    ...unmatchedSozRows.map((row) => ({
      id: `${row.source}-${row.rowNumber}`,
      status: 'blocked' as const,
      source: row.source,
      rowNumber: row.rowNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      tetaNumber: '',
      pesel: row.source === 'soz-pl' ? row.identityNumber : null,
      passportNumber: row.source === 'soz-ua' ? row.identityNumber : null,
      foreignDocumentNumber: null,
      contractStartDate: null,
      contractEndDate: null,
      sourceDepartmentName: '',
      departmentId: null,
      departmentName: null,
      companyHousingMediaAmount: row.companyHousingMediaAmount,
      companyHousingAccommodationAmount: row.companyHousingAccommodationAmount,
      ownHousingAllowanceAmount: row.ownHousingAllowanceAmount,
      warnings: [
        toyotaRowsByName.has(personNameKey(row.firstName, row.lastName))
          ? 'soz-ambiguous-match'
          : 'soz-unmatched',
        'missing-teta',
        'missing-employment-start',
      ] as EmployeeImportWarningCode[],
      createInput: null,
    })),
  ];
}

function dateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function parseSemicolonCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ';' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }
  return rows;
}

function parseSozCsvRow(
  row: CsvRow,
  source: 'soz-pl' | 'soz-ua',
  firstNameIndex: number,
  lastNameIndex: number,
  identityIndex: number,
): SozEmployeeImportRow {
  return {
    source,
    rowNumber: row.rowNumber,
    firstName: normalizeImportText(row.values[firstNameIndex]),
    lastName: normalizeImportText(row.values[lastNameIndex]),
    identityNumber: normalizeIdentityNumber(row.values[identityIndex]),
    companyHousingMediaAmount:
      source === 'soz-ua' ? sumAmountColumns(row, 'media') : 0,
    companyHousingAccommodationAmount:
      source === 'soz-ua' ? sumAmountColumns(row, 'mieszkanie') : 0,
    ownHousingAllowanceAmount:
      source === 'soz-pl' ? sumAmountColumns(row, 'dodatekzamieszkanie') : 0,
  };
}

function sumAmountColumns(row: CsvRow, requiredHeaderPart: string): number {
  return row.headers.reduce((total, header, index) => {
    const headerKey = normalizeImportKey(header);
    const isAmountColumn = headerKey.includes('kwota');
    if (!isAmountColumn || !headerKey.includes(requiredHeaderPart)) {
      return total;
    }
    return total + Math.max(0, parsePolishAmount(row.values[index]));
  }, 0);
}

function groupBy<T>(
  values: readonly T[],
  getKey: (value: T) => string,
): Map<string, T[]> {
  return values.reduce((groups, value) => {
    const key = getKey(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
    return groups;
  }, new Map<string, T[]>());
}

function findDuplicateTetaNumbers(
  rows: readonly ToyotaEmployeeImportRow[],
): Set<string> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = normalizeTetaNumber(row.tetaNumber);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );
}

function buildExistingIdentityMap(
  employees: readonly Employee[],
): Map<string, Employee> {
  const map = new Map<string, Employee>();
  employees.forEach((employee) => {
    [
      employee.pesel,
      employee.passportNumber,
      employee.foreignDocumentNumber,
    ].forEach((identity) => {
      const key = normalizeIdentityNumber(identity);
      if (key) {
        map.set(key, employee);
      }
    });
  });
  return map;
}

function pickFirstIdentity(rows: readonly SozEmployeeImportRow[]) {
  const identity = rows.map((row) => row.identityNumber).find(Boolean) ?? '';
  const isPesel = /^\d{11}$/.test(identity);
  return {
    pesel: isPesel ? identity : null,
    passportNumber: !isPesel && identity ? identity : null,
    foreignDocumentNumber: null,
  };
}

function findIdentityConflict(
  existingByIdentity: Map<string, Employee>,
  identity: ReturnType<typeof pickFirstIdentity>,
  tetaNumber: string,
): Employee | null {
  const identityValues = [
    identity.pesel,
    identity.passportNumber,
    identity.foreignDocumentNumber,
  ].filter(Boolean);
  for (const value of identityValues) {
    const existing = existingByIdentity.get(normalizeIdentityNumber(value));
    if (
      existing &&
      normalizeTetaNumber(existing.tetaNumber) !==
        normalizeTetaNumber(tetaNumber)
    ) {
      return existing;
    }
  }
  return null;
}

function resolveDepartment(
  sourceDepartmentName: string,
  departments: readonly Department[],
): {
  id: string | null;
  name: string | null;
  warning: Extract<
    EmployeeImportWarningCode,
    'department-na0' | 'department-unmapped'
  > | null;
} {
  const resolution = resolveCanonicalDepartment(sourceDepartmentName);
  if (resolution.status === 'unknown') {
    return { id: null, name: null, warning: 'department-unmapped' };
  }
  if (resolution.status === 'unresolved-na0') {
    return { id: null, name: null, warning: 'department-na0' };
  }

  const department = departments.find(
    (candidate) =>
      candidate.active && candidate.id === resolution.department.id,
  );

  return department
    ? { id: department.id, name: department.name, warning: null }
    : { id: null, name: null, warning: 'department-unmapped' };
}

function summarizeHousing(rows: readonly SozEmployeeImportRow[]) {
  return rows.reduce(
    (summary, row) => ({
      companyHousingMediaAmount:
        summary.companyHousingMediaAmount + row.companyHousingMediaAmount,
      companyHousingAccommodationAmount:
        summary.companyHousingAccommodationAmount +
        row.companyHousingAccommodationAmount,
      ownHousingAllowanceAmount:
        summary.ownHousingAllowanceAmount + row.ownHousingAllowanceAmount,
    }),
    {
      companyHousingMediaAmount: 0,
      companyHousingAccommodationAmount: 0,
      ownHousingAllowanceAmount: 0,
    },
  );
}

function resolveStatus(
  warnings: readonly EmployeeImportWarningCode[],
): EmployeeImportStatus {
  if (warnings.includes('existing-employee')) {
    return 'existing';
  }
  if (warnings.includes('duplicate-teta-in-import')) {
    return 'duplicate';
  }
  if (warnings.includes('identity-conflict')) {
    return 'conflict';
  }
  const blockingWarnings: EmployeeImportWarningCode[] = [
    'missing-name',
    'missing-teta',
    'missing-employment-start',
    'soz-unmatched',
    'soz-ambiguous-match',
  ];
  return warnings.some((warning) => blockingWarnings.includes(warning))
    ? 'blocked'
    : 'new';
}

function buildCreateInput(
  toyotaRow: ToyotaEmployeeImportRow,
  identity: ReturnType<typeof pickFirstIdentity>,
  departmentId: string | null,
): EmployeeCreateInput {
  return {
    tetaNumber: normalizeTetaNumber(toyotaRow.tetaNumber),
    firstName: toyotaRow.firstName,
    lastName: toyotaRow.lastName,
    pesel: identity.pesel,
    passportNumber: identity.passportNumber,
    foreignDocumentNumber: identity.foreignDocumentNumber,
    isActive: true,
    departmentId,
    shiftAssignment: null,
    initialContract: toyotaRow.contractStartDate
      ? {
          startDate: toyotaRow.contractStartDate,
          endDate: toyotaRow.contractEndDate,
        }
      : null,
  };
}
