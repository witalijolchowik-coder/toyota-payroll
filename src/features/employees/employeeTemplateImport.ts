import type {
  Department,
  Employee,
  EmployeeColorShift,
  EmployeeCreateInput,
} from '../../types/firestore';
import {
  isEmployeeColorShift,
  resolveCanonicalDepartment,
} from '../../utils/organization';
import {
  normalizeEmployeeInput,
  normalizeTetaNumber,
} from './employeeValidation';
import {
  formatImportDate,
  normalizeIdentityNumber,
  normalizeImportKey,
  normalizeImportText,
  parseImportedDate,
} from './employeeImport';

export const EMPLOYEE_TEMPLATE_CLEAR_MARKER = '__CLEAR__';

export const NEW_EMPLOYEE_TEMPLATE_FILE_NAME =
  'szablon_importu_nowych_pracownikow.csv';
export const EMPLOYEE_UPDATE_TEMPLATE_FILE_NAME =
  'szablon_aktualizacji_pracownikow.csv';

export const employeeTemplateHeaders = [
  'Numer TETA',
  'Imię',
  'Nazwisko',
  'PESEL',
  'Paszport',
  'Inny dokument',
  'Data rozpoczęcia pracy',
  'Data zakończenia pracy',
  'Dział',
  'Zmiana',
] as const;

export type EmployeeTemplateColumn = (typeof employeeTemplateHeaders)[number];

export type NewEmployeeTemplateStatus =
  'new' | 'existing' | 'duplicate' | 'conflict' | 'blocked';

export type BulkEmployeeUpdateStatus =
  'ready' | 'warning' | 'blocked' | 'no-changes';

export type EmployeeTemplateWarningCode =
  | 'missing-teta'
  | 'missing-first-name'
  | 'missing-last-name'
  | 'missing-employment-start'
  | 'invalid-employment-start'
  | 'invalid-employment-end'
  | 'invalid-date-range'
  | 'duplicate-teta-in-file'
  | 'existing-teta'
  | 'unknown-teta'
  | 'name-mismatch'
  | 'identity-conflict'
  | 'department-na0'
  | 'department-unmapped'
  | 'invalid-shift';

export interface NewEmployeeTemplatePreviewRow {
  id: string;
  rowNumber: number;
  status: NewEmployeeTemplateStatus;
  tetaNumber: string;
  firstName: string;
  lastName: string;
  pesel: string | null;
  passportNumber: string | null;
  foreignDocumentNumber: string | null;
  employmentStartDate: Date | null;
  employmentEndDate: Date | null;
  departmentId: string | null;
  departmentName: string | null;
  shiftAssignment: EmployeeColorShift | null;
  warnings: EmployeeTemplateWarningCode[];
  createInput: EmployeeCreateInput | null;
}

export interface BulkEmployeeUpdateChange {
  field: keyof EmployeeCreateInput;
  label: EmployeeTemplateColumn;
  oldValue: string;
  newValue: string;
}

export interface BulkEmployeeUpdatePreviewRow {
  id: string;
  rowNumber: number;
  status: BulkEmployeeUpdateStatus;
  employee: Employee | null;
  tetaNumber: string;
  firstName: string;
  lastName: string;
  warnings: EmployeeTemplateWarningCode[];
  changes: BulkEmployeeUpdateChange[];
  updateInput: EmployeeCreateInput | null;
}

interface ParsedTemplateRow {
  rowNumber: number;
  values: Record<EmployeeTemplateColumn, string>;
}

interface DepartmentResolution {
  departmentId: string | null;
  departmentName: string | null;
  warning: Extract<
    EmployeeTemplateWarningCode,
    'department-na0' | 'department-unmapped'
  > | null;
}

export function buildNewEmployeeTemplateCsv(): string {
  return buildCsv([employeeTemplateHeaders]);
}

export function buildEmployeeUpdateTemplateCsv(
  employees: readonly Employee[],
  departments: readonly Department[],
  today = new Date(),
): string {
  const rows = employees
    .filter((employee) => shouldIncludeInUpdateTemplate(employee, today))
    .sort((left, right) =>
      normalizeTetaNumber(left.tetaNumber).localeCompare(
        normalizeTetaNumber(right.tetaNumber),
        'pl-PL',
      ),
    )
    .map((employee) => employeeToTemplateRow(employee, departments));

  return buildCsv([employeeTemplateHeaders, ...rows]);
}

export function buildNewEmployeeTemplatePreview(
  csvText: string,
  existingEmployees: readonly Employee[],
  departments: readonly Department[],
): NewEmployeeTemplatePreviewRow[] {
  const rows = parseEmployeeTemplateCsv(csvText);
  const duplicateTetas = findDuplicateTetas(rows);
  const existingByTeta = buildEmployeeByTeta(existingEmployees);
  const existingByIdentity = buildEmployeeByIdentity(existingEmployees);

  return rows.map((row) => {
    const raw = readTemplateEmployeeValues(row);
    const warnings: EmployeeTemplateWarningCode[] = [];

    if (!raw.tetaNumber) {
      warnings.push('missing-teta');
    }
    if (!raw.firstName) {
      warnings.push('missing-first-name');
    }
    if (!raw.lastName) {
      warnings.push('missing-last-name');
    }
    if (!row.values['Data rozpoczęcia pracy']) {
      warnings.push('missing-employment-start');
    }
    if (row.values['Data rozpoczęcia pracy'] && !raw.employmentStartDate) {
      warnings.push('invalid-employment-start');
    }
    if (row.values['Data zakończenia pracy'] && !raw.employmentEndDate) {
      warnings.push('invalid-employment-end');
    }
    if (
      raw.employmentStartDate &&
      raw.employmentEndDate &&
      raw.employmentEndDate < raw.employmentStartDate
    ) {
      warnings.push('invalid-date-range');
    }
    if (duplicateTetas.has(raw.tetaNumber)) {
      warnings.push('duplicate-teta-in-file');
    }
    if (raw.tetaNumber && existingByTeta.has(raw.tetaNumber)) {
      warnings.push('existing-teta');
    }
    if (hasIdentityConflict(existingByIdentity, raw, raw.tetaNumber)) {
      warnings.push('identity-conflict');
    }

    const department = resolveTemplateDepartment(
      row.values['Dział'],
      departments,
    );
    if (department.warning) {
      warnings.push(department.warning);
    }

    if (row.values['Zmiana'] && !raw.shiftAssignment) {
      warnings.push('invalid-shift');
    }

    const status = resolveNewEmployeeTemplateStatus(warnings);
    const createInput =
      status === 'new'
        ? normalizeEmployeeInput({
            ...raw,
            departmentId: department.departmentId,
            isActive: true,
          })
        : null;

    return {
      id: `new-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      status,
      ...raw,
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      warnings,
      createInput,
    };
  });
}

export function buildBulkEmployeeUpdatePreview(
  csvText: string,
  existingEmployees: readonly Employee[],
  departments: readonly Department[],
): BulkEmployeeUpdatePreviewRow[] {
  const rows = parseEmployeeTemplateCsv(csvText);
  const employeesByTeta = buildEmployeeByTeta(existingEmployees);
  const existingByIdentity = buildEmployeeByIdentity(existingEmployees);

  return rows.map((row) => {
    const rawTeta = normalizeTetaNumber(row.values['Numer TETA']);
    const employee = employeesByTeta.get(rawTeta) ?? null;
    const warnings: EmployeeTemplateWarningCode[] = [];

    if (!rawTeta) {
      warnings.push('missing-teta');
    }
    if (!employee && rawTeta) {
      warnings.push('unknown-teta');
    }

    if (employee && hasNameMismatch(row, employee)) {
      warnings.push('name-mismatch');
    }

    const baseInput = employee ? employeeToUpdateInput(employee) : null;
    const updateInput = baseInput ? { ...baseInput } : null;
    const changes: BulkEmployeeUpdateChange[] = [];

    if (employee && updateInput) {
      applyTextUpdate(row, employee, updateInput, changes, 'Imię', 'firstName');
      applyTextUpdate(
        row,
        employee,
        updateInput,
        changes,
        'Nazwisko',
        'lastName',
      );
      applyNullableTextUpdate(
        row,
        employee,
        updateInput,
        changes,
        'PESEL',
        'pesel',
      );
      applyNullableTextUpdate(
        row,
        employee,
        updateInput,
        changes,
        'Paszport',
        'passportNumber',
      );
      applyNullableTextUpdate(
        row,
        employee,
        updateInput,
        changes,
        'Inny dokument',
        'foreignDocumentNumber',
      );
      applyDateUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        'Data rozpoczęcia pracy',
        'employmentStartDate',
        'invalid-employment-start',
      );
      applyDateUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        'Data zakończenia pracy',
        'employmentEndDate',
        'invalid-employment-end',
      );
      applyDepartmentUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        departments,
      );
      applyShiftUpdate(row, employee, updateInput, changes, warnings);

      if (
        updateInput.employmentStartDate &&
        updateInput.employmentEndDate &&
        updateInput.employmentEndDate < updateInput.employmentStartDate
      ) {
        warnings.push('invalid-date-range');
      }
      if (hasIdentityConflict(existingByIdentity, updateInput, rawTeta)) {
        warnings.push('identity-conflict');
      }
    }

    const status = resolveBulkUpdateStatus(warnings, changes);

    return {
      id: `update-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      status,
      employee,
      tetaNumber: rawTeta,
      firstName:
        normalizeImportText(row.values['Imię']) || employee?.firstName || '',
      lastName:
        normalizeImportText(row.values['Nazwisko']) || employee?.lastName || '',
      warnings,
      changes,
      updateInput:
        status === 'ready' || status === 'warning' ? updateInput : null,
    };
  });
}

export function shouldIncludeInUpdateTemplate(
  employee: Employee,
  today = new Date(),
): boolean {
  if (!employee.isActive) {
    return false;
  }
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return (
    !employee.employmentEndDate || employee.employmentEndDate >= todayStart
  );
}

function parseEmployeeTemplateCsv(csvText: string): ParsedTemplateRow[] {
  const matrix = parseSemicolonCsv(csvText);
  if (matrix.length < 2) {
    return [];
  }

  const headerMap = new Map<EmployeeTemplateColumn, number>();
  matrix[0].forEach((header, index) => {
    const column = resolveTemplateColumn(header);
    if (column && !headerMap.has(column)) {
      headerMap.set(column, index);
    }
  });

  return matrix.slice(1).flatMap((row, index) => {
    const values = Object.fromEntries(
      employeeTemplateHeaders.map((header) => [
        header,
        normalizeImportText(row[headerMap.get(header) ?? -1]),
      ]),
    ) as Record<EmployeeTemplateColumn, string>;
    if (!Object.values(values).some(Boolean)) {
      return [];
    }
    return [{ rowNumber: index + 2, values }];
  });
}

function resolveTemplateColumn(value: string): EmployeeTemplateColumn | null {
  const key = normalizeImportKey(value);
  const mapping: Record<string, EmployeeTemplateColumn> = {
    numerteta: 'Numer TETA',
    tetanumber: 'Numer TETA',
    teta: 'Numer TETA',
    imie: 'Imię',
    firstname: 'Imię',
    nazwisko: 'Nazwisko',
    lastname: 'Nazwisko',
    pesel: 'PESEL',
    paszport: 'Paszport',
    passport: 'Paszport',
    passportnumber: 'Paszport',
    innydokument: 'Inny dokument',
    foreigndocumentnumber: 'Inny dokument',
    datarozpoczeciapracy: 'Data rozpoczęcia pracy',
    employmentstart: 'Data rozpoczęcia pracy',
    employmentstartdate: 'Data rozpoczęcia pracy',
    datazakonczeniapracy: 'Data zakończenia pracy',
    employmentend: 'Data zakończenia pracy',
    employmentenddate: 'Data zakończenia pracy',
    dzial: 'Dział',
    department: 'Dział',
    zmiana: 'Zmiana',
    shift: 'Zmiana',
  };
  return mapping[key] ?? null;
}

function readTemplateEmployeeValues(row: ParsedTemplateRow): Omit<
  EmployeeCreateInput,
  'isActive' | 'departmentId'
> & {
  departmentId?: never;
} {
  const shift = normalizeImportText(row.values['Zmiana']).toLocaleUpperCase(
    'pl-PL',
  );
  return {
    tetaNumber: normalizeTetaNumber(row.values['Numer TETA']),
    firstName: normalizeImportText(row.values['Imię']),
    lastName: normalizeImportText(row.values['Nazwisko']),
    pesel: normalizeIdentityNumber(row.values['PESEL']) || null,
    passportNumber: normalizeIdentityNumber(row.values['Paszport']) || null,
    foreignDocumentNumber:
      normalizeIdentityNumber(row.values['Inny dokument']) || null,
    shiftAssignment: isEmployeeColorShift(shift) ? shift : null,
    employmentStartDate: parseImportedDate(
      row.values['Data rozpoczęcia pracy'],
    ),
    employmentEndDate: parseImportedDate(row.values['Data zakończenia pracy']),
  };
}

function resolveTemplateDepartment(
  value: string,
  departments: readonly Department[],
): DepartmentResolution {
  const raw = normalizeImportText(value);
  if (!raw) {
    return { departmentId: null, departmentName: null, warning: null };
  }

  const resolution = resolveCanonicalDepartment(raw);
  if (resolution.status === 'unresolved-na0') {
    return {
      departmentId: null,
      departmentName: null,
      warning: 'department-na0',
    };
  }

  if (resolution.status === 'matched') {
    const department = departments.find(
      (candidate) =>
        candidate.active && candidate.id === resolution.department.id,
    );
    if (!department) {
      return {
        departmentId: null,
        departmentName: null,
        warning: 'department-unmapped',
      };
    }
    return {
      departmentId: department.id,
      departmentName: department.name,
      warning: null,
    };
  }

  return {
    departmentId: null,
    departmentName: null,
    warning: 'department-unmapped',
  };
}

function resolveNewEmployeeTemplateStatus(
  warnings: readonly EmployeeTemplateWarningCode[],
): NewEmployeeTemplateStatus {
  if (warnings.includes('existing-teta')) {
    return 'existing';
  }
  if (warnings.includes('duplicate-teta-in-file')) {
    return 'duplicate';
  }
  if (warnings.includes('identity-conflict')) {
    return 'conflict';
  }
  const blockingWarnings: EmployeeTemplateWarningCode[] = [
    'missing-first-name',
    'missing-last-name',
    'missing-employment-start',
    'invalid-employment-start',
    'invalid-employment-end',
    'invalid-date-range',
    'invalid-shift',
  ];
  return warnings.some((warning) => blockingWarnings.includes(warning))
    ? 'blocked'
    : 'new';
}

function resolveBulkUpdateStatus(
  warnings: readonly EmployeeTemplateWarningCode[],
  changes: readonly BulkEmployeeUpdateChange[],
): BulkEmployeeUpdateStatus {
  const blockingWarnings: EmployeeTemplateWarningCode[] = [
    'missing-teta',
    'unknown-teta',
    'identity-conflict',
    'invalid-employment-start',
    'invalid-employment-end',
    'invalid-date-range',
    'invalid-shift',
  ];
  if (warnings.some((warning) => blockingWarnings.includes(warning))) {
    return 'blocked';
  }
  if (changes.length === 0) {
    return 'no-changes';
  }
  return warnings.length > 0 ? 'warning' : 'ready';
}

function employeeToTemplateRow(
  employee: Employee,
  departments: readonly Department[],
): string[] {
  const department = departments.find(
    (candidate) => candidate.id === employee.departmentId,
  );
  return [
    employee.tetaNumber,
    employee.firstName,
    employee.lastName,
    employee.pesel ?? '',
    employee.passportNumber ?? '',
    employee.foreignDocumentNumber ?? '',
    formatImportDate(employee.employmentStartDate),
    formatImportDate(employee.employmentEndDate),
    department?.name ?? '',
    employee.shiftAssignment ?? '',
  ];
}

function employeeToUpdateInput(employee: Employee): EmployeeCreateInput {
  return {
    tetaNumber: employee.tetaNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    pesel: employee.pesel,
    passportNumber: employee.passportNumber,
    foreignDocumentNumber: employee.foreignDocumentNumber,
    isActive: employee.isActive,
    departmentId: employee.departmentId,
    shiftAssignment: employee.shiftAssignment,
    employmentStartDate: employee.employmentStartDate,
    employmentEndDate: employee.employmentEndDate,
    citizenship: employee.citizenship,
    firstToyotaEmploymentDate: employee.firstToyotaEmploymentDate,
  };
}

function applyTextUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  column: EmployeeTemplateColumn,
  field: Extract<keyof EmployeeCreateInput, 'firstName' | 'lastName'>,
) {
  const value = normalizeImportText(row.values[column]);
  if (!value || value === employee[field]) {
    return;
  }
  updateInput[field] = value;
  changes.push({
    field,
    label: column,
    oldValue: employee[field],
    newValue: value,
  });
}

function applyNullableTextUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  column: EmployeeTemplateColumn,
  field: Extract<
    keyof EmployeeCreateInput,
    'pesel' | 'passportNumber' | 'foreignDocumentNumber'
  >,
) {
  const raw = normalizeImportText(row.values[column]);
  if (!raw) {
    return;
  }
  const value =
    raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER
      ? null
      : normalizeIdentityNumber(raw);
  if (value === employee[field]) {
    return;
  }
  updateInput[field] = value;
  changes.push({
    field,
    label: column,
    oldValue: employee[field] ?? '',
    newValue: value ?? EMPLOYEE_TEMPLATE_CLEAR_MARKER,
  });
}

function applyDateUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
  column: Extract<
    EmployeeTemplateColumn,
    'Data rozpoczęcia pracy' | 'Data zakończenia pracy'
  >,
  field: Extract<
    keyof EmployeeCreateInput,
    'employmentStartDate' | 'employmentEndDate'
  >,
  invalidWarning: Extract<
    EmployeeTemplateWarningCode,
    'invalid-employment-start' | 'invalid-employment-end'
  >,
) {
  const raw = normalizeImportText(row.values[column]);
  if (!raw) {
    return;
  }
  const value =
    raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER ? null : parseImportedDate(raw);
  if (raw !== EMPLOYEE_TEMPLATE_CLEAR_MARKER && !value) {
    warnings.push(invalidWarning);
    return;
  }
  const oldValue = employee[field];
  if (formatImportDate(oldValue) === formatImportDate(value)) {
    return;
  }
  updateInput[field] = value;
  changes.push({
    field,
    label: column,
    oldValue: formatImportDate(oldValue),
    newValue: value ? formatImportDate(value) : EMPLOYEE_TEMPLATE_CLEAR_MARKER,
  });
}

function applyDepartmentUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
  departments: readonly Department[],
) {
  const raw = normalizeImportText(row.values['Dział']);
  if (!raw) {
    return;
  }
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.departmentId) {
      updateInput.departmentId = null;
      changes.push({
        field: 'departmentId',
        label: 'Dział',
        oldValue: employee.departmentId,
        newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
      });
    }
    return;
  }
  const department = resolveTemplateDepartment(raw, departments);
  if (department.warning) {
    warnings.push(department.warning);
    return;
  }
  if (department.departmentId !== employee.departmentId) {
    updateInput.departmentId = department.departmentId;
    changes.push({
      field: 'departmentId',
      label: 'Dział',
      oldValue: employee.departmentId ?? '',
      newValue: department.departmentName ?? department.departmentId ?? '',
    });
  }
}

function applyShiftUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
) {
  const raw = normalizeImportText(row.values['Zmiana']);
  if (!raw) {
    return;
  }
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.shiftAssignment) {
      updateInput.shiftAssignment = null;
      changes.push({
        field: 'shiftAssignment',
        label: 'Zmiana',
        oldValue: employee.shiftAssignment,
        newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
      });
    }
    return;
  }
  const shift = raw.toLocaleUpperCase('pl-PL');
  if (!isEmployeeColorShift(shift)) {
    warnings.push('invalid-shift');
    return;
  }
  if (shift !== employee.shiftAssignment) {
    updateInput.shiftAssignment = shift;
    changes.push({
      field: 'shiftAssignment',
      label: 'Zmiana',
      oldValue: employee.shiftAssignment ?? '',
      newValue: shift,
    });
  }
}

function hasNameMismatch(row: ParsedTemplateRow, employee: Employee): boolean {
  const firstName = normalizeImportText(row.values['Imię']);
  const lastName = normalizeImportText(row.values['Nazwisko']);
  return (
    (Boolean(firstName) && firstName !== employee.firstName) ||
    (Boolean(lastName) && lastName !== employee.lastName)
  );
}

function findDuplicateTetas(rows: readonly ParsedTemplateRow[]): Set<string> {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const teta = normalizeTetaNumber(row.values['Numer TETA']);
    if (teta) {
      counts.set(teta, (counts.get(teta) ?? 0) + 1);
    }
  });
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([teta]) => teta),
  );
}

function buildEmployeeByTeta(
  employees: readonly Employee[],
): Map<string, Employee> {
  return new Map(
    employees.map((employee) => [
      normalizeTetaNumber(employee.tetaNumber),
      employee,
    ]),
  );
}

function buildEmployeeByIdentity(
  employees: readonly Employee[],
): Map<string, Employee> {
  const map = new Map<string, Employee>();
  employees.forEach((employee) => {
    [employee.pesel, employee.passportNumber, employee.foreignDocumentNumber]
      .map(normalizeIdentityNumber)
      .filter(Boolean)
      .forEach((identity) => map.set(identity, employee));
  });
  return map;
}

function hasIdentityConflict(
  existingByIdentity: Map<string, Employee>,
  input: Pick<
    EmployeeCreateInput,
    'pesel' | 'passportNumber' | 'foreignDocumentNumber'
  >,
  tetaNumber: string,
): boolean {
  return [input.pesel, input.passportNumber, input.foreignDocumentNumber]
    .map(normalizeIdentityNumber)
    .filter(Boolean)
    .some((identity) => {
      const employee = existingByIdentity.get(identity);
      return (
        employee &&
        normalizeTetaNumber(employee.tetaNumber) !==
          normalizeTetaNumber(tetaNumber)
      );
    });
}

function buildCsv(rows: readonly (readonly string[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n')}\r\n`;
}

function escapeCsvCell(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function parseSemicolonCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, '');

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
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
