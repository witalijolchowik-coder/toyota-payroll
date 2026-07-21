import type {
  Department,
  Employee,
  EmployeeContract,
  EmployeeColorShift,
  EmployeeCreateInput,
  IsoDate,
} from '../../types/firestore';
import {
  activeContracts,
  deriveEmployeeMedicalStatus,
  isEmployeeArchived,
  isValidCitizenship,
  normalizeCitizenship,
  normalizeEmployeeGender,
  normalizeMedicalExaminationType,
  normalizePhoneNumber,
  type EmployeeMedicalStatus,
} from '../../utils/employees';
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
  'Numer telefonu',
  'PESEL',
  'Paszport',
  'Obywatelstwo',
  'Płeć',
  'Data pierwszego zatrudnienia w Toyota',
  'Umowa 1 od',
  'Umowa 1 do',
  'Umowa 2 od',
  'Umowa 2 do',
  'Umowa 3 od',
  'Umowa 3 do',
  'Umowa 4 od',
  'Umowa 4 do',
  'Umowa 5 od',
  'Umowa 5 do',
  'Dział',
  'Grupa zmianowa',
  'Data badania lekarskiego',
  'Badanie ważne do',
  'Typ badania lekarskiego',
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
  | 'missing-contract'
  | 'partial-contract'
  | 'invalid-contract-date'
  | 'invalid-contract-range'
  | 'duplicate-contract'
  | 'overlapping-contract'
  | 'ambiguous-contract-match'
  | 'locked-contract-month'
  | 'more-than-five-contracts'
  | 'legacy-employment-columns-ignored'
  | 'duplicate-teta-in-file'
  | 'existing-teta'
  | 'unknown-teta'
  | 'ambiguous-teta'
  | 'name-mismatch'
  | 'identity-conflict'
  | 'department-na0'
  | 'department-unmapped'
  | 'invalid-shift'
  | 'invalid-shift-for-department'
  | 'invalid-citizenship'
  | 'invalid-gender'
  | 'invalid-first-toyota-employment-date'
  | 'invalid-medical-examination-date'
  | 'invalid-medical-valid-until'
  | 'invalid-medical-date-range'
  | 'invalid-medical-type'
  | 'medical-type-department-mismatch'
  | 'medical-expired'
  | 'medical-expiring-soon'
  | 'medical-missing-validity';

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
  importedContracts: ImportedEmployeeContract[];
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

export interface ImportedEmployeeContract {
  slot: number;
  startDate: IsoDate;
  endDate: IsoDate;
}

export type BulkContractChangeKind =
  'unchanged' | 'create' | 'update' | 'untouched';

export interface BulkEmployeeContractChange {
  kind: BulkContractChangeKind;
  imported: ImportedEmployeeContract | null;
  existing: EmployeeContract | null;
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
  contractChanges: BulkEmployeeContractChange[];
  importedContracts: ImportedEmployeeContract[];
  contractOpenMonths?: string[];
  contractLockedMonths?: string[];
  updateInput: EmployeeCreateInput | null;
  resultingMedicalStatus?: EmployeeMedicalStatus | null;
}

interface ParsedTemplateRow {
  rowNumber: number;
  values: Record<EmployeeTemplateColumn, string>;
  legacyEmploymentColumnsPresent: boolean;
}

interface DepartmentResolution {
  departmentId: string | null;
  departmentName: string | null;
  warning: Extract<
    EmployeeTemplateWarningCode,
    'department-na0' | 'department-unmapped'
  > | null;
}

const CONTRACT_SLOT_COUNT = 5;

function contractColumn(
  slot: number,
  edge: 'od' | 'do',
): EmployeeTemplateColumn {
  return `Umowa ${slot} ${edge}` as EmployeeTemplateColumn;
}

function toIsoDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10) as IsoDate;
}

function readImportedContracts(row: ParsedTemplateRow): {
  contracts: ImportedEmployeeContract[];
  warnings: EmployeeTemplateWarningCode[];
} {
  const contracts: ImportedEmployeeContract[] = [];
  const warnings: EmployeeTemplateWarningCode[] = [];

  for (let slot = 1; slot <= CONTRACT_SLOT_COUNT; slot += 1) {
    const rawStart = row.values[contractColumn(slot, 'od')];
    const rawEnd = row.values[contractColumn(slot, 'do')];
    if (!rawStart && !rawEnd) continue;
    if (!rawStart || !rawEnd) {
      warnings.push('partial-contract');
      continue;
    }
    const start = parseImportedDate(rawStart);
    const end = parseImportedDate(rawEnd);
    if (!start || !end) {
      warnings.push('invalid-contract-date');
      continue;
    }
    const contract = {
      slot,
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
    };
    if (contract.endDate < contract.startDate) {
      warnings.push('invalid-contract-range');
      continue;
    }
    contracts.push(contract);
  }

  contracts.sort((left, right) =>
    left.startDate === right.startDate
      ? left.endDate.localeCompare(right.endDate)
      : left.startDate.localeCompare(right.startDate),
  );
  for (let index = 0; index < contracts.length; index += 1) {
    const current = contracts[index]!;
    const previous = contracts[index - 1];
    if (
      contracts.some(
        (candidate, candidateIndex) =>
          candidateIndex < index &&
          candidate.startDate === current.startDate &&
          candidate.endDate === current.endDate,
      )
    ) {
      warnings.push('duplicate-contract');
    } else if (previous && current.startDate <= previous.endDate) {
      warnings.push('overlapping-contract');
    }
  }

  if (row.legacyEmploymentColumnsPresent) {
    warnings.push('legacy-employment-columns-ignored');
  }
  return { contracts, warnings: [...new Set(warnings)] };
}

export function planEmployeeContractImport(
  employee: Employee,
  importedContracts: readonly ImportedEmployeeContract[],
): {
  changes: BulkEmployeeContractChange[];
  warnings: EmployeeTemplateWarningCode[];
} {
  const existing = activeContracts(employee);
  const warnings: EmployeeTemplateWarningCode[] = [];
  if (existing.length > CONTRACT_SLOT_COUNT) {
    warnings.push('more-than-five-contracts');
  }
  if (importedContracts.length === 0) {
    return {
      changes: existing.map((contract) => ({
        kind: 'untouched',
        imported: null,
        existing: contract,
      })),
      warnings,
    };
  }

  const changes: BulkEmployeeContractChange[] = [];
  const claimedExistingIds = new Set<string>();
  const claimedImportedSlots = new Set<number>();
  importedContracts.forEach((imported) => {
    const exact = existing.find(
      (contract) =>
        !claimedExistingIds.has(contract.id) &&
        contract.startDate === imported.startDate &&
        contract.endDate === imported.endDate,
    );
    if (exact) {
      claimedExistingIds.add(exact.id);
      claimedImportedSlots.add(imported.slot);
      changes.push({ kind: 'unchanged', imported, existing: exact });
    }
  });

  const unmatchedImported = importedContracts.filter(
    (contract) => !claimedImportedSlots.has(contract.slot),
  );
  const unmatchedExisting = existing.filter(
    (contract) => !claimedExistingIds.has(contract.id),
  );

  if (
    unmatchedImported.length > 0 &&
    importedContracts.length === existing.length &&
    unmatchedImported.length === unmatchedExisting.length
  ) {
    unmatchedImported.forEach((imported, index) => {
      changes.push({
        kind: 'update',
        imported,
        existing: unmatchedExisting[index]!,
      });
      claimedExistingIds.add(unmatchedExisting[index]!.id);
    });
  } else {
    unmatchedImported.forEach((imported) => {
      const overlaps = unmatchedExisting.filter(
        (contract) =>
          contract.startDate <= imported.endDate &&
          (contract.endDate ?? '9999-12-31') >= imported.startDate,
      );
      if (overlaps.length > 0) {
        warnings.push('ambiguous-contract-match');
      } else {
        changes.push({ kind: 'create', imported, existing: null });
      }
    });
  }

  existing
    .filter((contract) => !claimedExistingIds.has(contract.id))
    .forEach((contract) =>
      changes.push({ kind: 'untouched', imported: null, existing: contract }),
    );
  return { changes, warnings: [...new Set(warnings)] };
}

export function buildNewEmployeeTemplateCsv(): string {
  return buildCsv([employeeTemplateHeaders]);
}

export function buildEmployeeUpdateTemplateCsv(
  employees: readonly Employee[],
  _departments: readonly Department[],
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
    .map((employee) => employeeToTemplateRow(employee));

  return buildCsv([employeeTemplateHeaders, ...rows]);
}

export function employeesExceedingContractTemplateLimit(
  employees: readonly Employee[],
): Employee[] {
  return employees.filter(
    (employee) => activeContracts(employee).length > CONTRACT_SLOT_COUNT,
  );
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
    const contractData = readImportedContracts(row);
    const raw = readTemplateEmployeeValues(row, contractData.contracts);
    const warnings: EmployeeTemplateWarningCode[] = [...contractData.warnings];

    if (!raw.tetaNumber) {
      warnings.push('missing-teta');
    }
    if (!raw.firstName) {
      warnings.push('missing-first-name');
    }
    if (!raw.lastName) {
      warnings.push('missing-last-name');
    }
    if (contractData.contracts.length === 0) warnings.push('missing-contract');
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

    if (row.values['Grupa zmianowa'] && !raw.shiftAssignment) {
      warnings.push('invalid-shift');
    }
    if (
      row.values['Obywatelstwo'] &&
      !isValidCitizenship(row.values['Obywatelstwo'])
    ) {
      warnings.push('invalid-citizenship');
    }
    if (row.values['Płeć'] && !raw.gender) {
      warnings.push('invalid-gender');
    }
    if (
      row.values['Data pierwszego zatrudnienia w Toyota'] &&
      !raw.firstToyotaEmploymentDate
    ) {
      warnings.push('invalid-first-toyota-employment-date');
    }
    if (row.values['Data badania lekarskiego'] && !raw.medicalExaminationDate) {
      warnings.push('invalid-medical-examination-date');
    }
    if (row.values['Badanie ważne do'] && !raw.medicalValidUntil) {
      warnings.push('invalid-medical-valid-until');
    }
    if (
      raw.medicalExaminationDate &&
      raw.medicalValidUntil &&
      raw.medicalValidUntil < raw.medicalExaminationDate
    ) {
      warnings.push('invalid-medical-date-range');
    }
    if (row.values['Typ badania lekarskiego'] && !raw.medicalExaminationType) {
      warnings.push('invalid-medical-type');
    }
    const medicalStatus = deriveEmployeeMedicalStatus(
      raw,
      department.departmentName,
    );
    if (medicalStatus.issues.includes('department-mismatch')) {
      warnings.push('medical-type-department-mismatch');
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
      importedContracts: contractData.contracts,
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
  const employeesByTeta = buildEmployeesByTeta(existingEmployees);
  const existingByIdentity = buildEmployeeByIdentity(existingEmployees);

  return rows.map((row) => {
    const rawTeta = normalizeTetaNumber(row.values['Numer TETA']);
    const matchingEmployees = employeesByTeta.get(rawTeta) ?? [];
    const employee =
      matchingEmployees.length === 1 ? matchingEmployees[0] : null;
    const contractData = readImportedContracts(row);
    const warnings: EmployeeTemplateWarningCode[] = [...contractData.warnings];

    if (!rawTeta) {
      warnings.push('missing-teta');
    }
    if (rawTeta && matchingEmployees.length === 0) {
      warnings.push('unknown-teta');
    }
    if (matchingEmployees.length > 1) {
      warnings.push('ambiguous-teta');
    }

    if (employee && hasNameMismatch(row, employee)) {
      warnings.push('name-mismatch');
    }

    const baseInput = employee ? employeeToUpdateInput(employee) : null;
    const updateInput = baseInput ? { ...baseInput } : null;
    const changes: BulkEmployeeUpdateChange[] = [];

    if (employee && updateInput) {
      applyPhoneUpdate(row, employee, updateInput, changes);
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
      applyCitizenshipUpdate(row, employee, updateInput, changes, warnings);
      applyGenderUpdate(row, employee, updateInput, changes, warnings);
      applyDateUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        'Data pierwszego zatrudnienia w Toyota',
        'firstToyotaEmploymentDate',
        'invalid-first-toyota-employment-date',
      );
      applyDepartmentUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        departments,
      );
      applyShiftUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        departments,
      );
      applyDateUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        'Data badania lekarskiego',
        'medicalExaminationDate',
        'invalid-medical-examination-date',
      );
      applyDateUpdate(
        row,
        employee,
        updateInput,
        changes,
        warnings,
        'Badanie ważne do',
        'medicalValidUntil',
        'invalid-medical-valid-until',
      );
      applyMedicalTypeUpdate(row, employee, updateInput, changes, warnings);

      if (
        updateInput.medicalExaminationDate &&
        updateInput.medicalValidUntil &&
        updateInput.medicalValidUntil < updateInput.medicalExaminationDate
      ) {
        warnings.push('invalid-medical-date-range');
      }
      if (hasIdentityConflict(existingByIdentity, updateInput, rawTeta)) {
        warnings.push('identity-conflict');
      }
    }

    const resultingMedicalStatus =
      employee && updateInput
        ? deriveEmployeeMedicalStatus(
            updateInput,
            departmentNameForInput(updateInput, departments),
          )
        : null;
    const medicalFieldChange = changes.some((change) =>
      [
        'medicalExaminationDate',
        'medicalValidUntil',
        'medicalExaminationType',
      ].includes(change.field),
    );
    const compatibilityRelevantChange = changes.some((change) =>
      ['departmentId', 'medicalExaminationType'].includes(change.field),
    );
    if (
      compatibilityRelevantChange &&
      resultingMedicalStatus?.issues.includes('department-mismatch')
    ) {
      warnings.push('medical-type-department-mismatch');
    }
    if (medicalFieldChange) {
      if (resultingMedicalStatus?.issues.includes('expired')) {
        warnings.push('medical-expired');
      }
      if (resultingMedicalStatus?.issues.includes('expiring-soon')) {
        warnings.push('medical-expiring-soon');
      }
      if (resultingMedicalStatus?.issues.includes('missing-validity')) {
        warnings.push('medical-missing-validity');
      }
    }

    const contractPlan = employee
      ? planEmployeeContractImport(employee, contractData.contracts)
      : { changes: [], warnings: [] };
    warnings.push(...contractPlan.warnings);
    const status = resolveBulkUpdateStatus(
      [...new Set(warnings)],
      changes,
      contractPlan.changes,
    );

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
      warnings: [...new Set(warnings)],
      changes,
      contractChanges: contractPlan.changes,
      importedContracts: contractData.contracts,
      updateInput:
        status === 'ready' || status === 'warning' ? updateInput : null,
      resultingMedicalStatus,
    };
  });
}

export function shouldIncludeInUpdateTemplate(
  employee: Employee,
  today = new Date(),
): boolean {
  return !isEmployeeArchived(employee, today);
}

function parseEmployeeTemplateCsv(csvText: string): ParsedTemplateRow[] {
  const matrix = parseSemicolonCsv(csvText);
  if (matrix.length < 2) {
    return [];
  }

  const headerMap = new Map<EmployeeTemplateColumn, number>();
  const legacyEmploymentColumnsPresent = matrix[0].some((header) =>
    [
      'datarozpoczeciapracy',
      'employmentstart',
      'employmentstartdate',
      'datazakonczeniapracy',
      'employmentend',
      'employmentenddate',
    ].includes(normalizeImportKey(header)),
  );
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
    return [{ rowNumber: index + 2, values, legacyEmploymentColumnsPresent }];
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
    numertelefonu: 'Numer telefonu',
    telefon: 'Numer telefonu',
    phonenumber: 'Numer telefonu',
    pesel: 'PESEL',
    paszport: 'Paszport',
    passport: 'Paszport',
    passportnumber: 'Paszport',
    obywatelstwo: 'Obywatelstwo',
    citizenship: 'Obywatelstwo',
    plec: 'Płeć',
    gender: 'Płeć',
    datapierwszegozatrudnieniawtoyota: 'Data pierwszego zatrudnienia w Toyota',
    firsttoyotaemploymentdate: 'Data pierwszego zatrudnienia w Toyota',
    umowa1od: 'Umowa 1 od',
    umowa1do: 'Umowa 1 do',
    umowa2od: 'Umowa 2 od',
    umowa2do: 'Umowa 2 do',
    umowa3od: 'Umowa 3 od',
    umowa3do: 'Umowa 3 do',
    umowa4od: 'Umowa 4 od',
    umowa4do: 'Umowa 4 do',
    umowa5od: 'Umowa 5 od',
    umowa5do: 'Umowa 5 do',
    dzial: 'Dział',
    department: 'Dział',
    grupazmianowa: 'Grupa zmianowa',
    zmiana: 'Grupa zmianowa',
    shift: 'Grupa zmianowa',
    shiftgroup: 'Grupa zmianowa',
    databadanialekarskiego: 'Data badania lekarskiego',
    databadania: 'Data badania lekarskiego',
    medicalexaminationdate: 'Data badania lekarskiego',
    badaniewaznedo: 'Badanie ważne do',
    medicalvaliduntil: 'Badanie ważne do',
    typbadanialekarskiego: 'Typ badania lekarskiego',
    medicalexaminationtype: 'Typ badania lekarskiego',
  };
  return mapping[key] ?? null;
}

function readTemplateEmployeeValues(
  row: ParsedTemplateRow,
  contracts: readonly ImportedEmployeeContract[],
): Omit<EmployeeCreateInput, 'isActive' | 'departmentId'> & {
  departmentId?: never;
} {
  const shift = normalizeImportText(
    row.values['Grupa zmianowa'],
  ).toLocaleUpperCase('pl-PL');
  return {
    tetaNumber: normalizeTetaNumber(row.values['Numer TETA']),
    firstName: normalizeImportText(row.values['Imię']),
    lastName: normalizeImportText(row.values['Nazwisko']),
    pesel: normalizeIdentityNumber(row.values['PESEL']) || null,
    passportNumber: normalizeIdentityNumber(row.values['Paszport']) || null,
    foreignDocumentNumber: null,
    phoneNumber: normalizePhoneNumber(row.values['Numer telefonu']) || null,
    citizenship: normalizeCitizenship(row.values['Obywatelstwo']) ?? null,
    gender: normalizeEmployeeGender(row.values['Płeć']),
    firstToyotaEmploymentDate: parseImportedDate(
      row.values['Data pierwszego zatrudnienia w Toyota'],
    ),
    medicalExaminationDate: parseImportedDate(
      row.values['Data badania lekarskiego'],
    ),
    medicalValidUntil: parseImportedDate(row.values['Badanie ważne do']),
    medicalExaminationType: normalizeMedicalExaminationType(
      row.values['Typ badania lekarskiego'],
    ),
    shiftAssignment: isEmployeeColorShift(shift) ? shift : null,
    // Compatibility values for atomic creation only. Contract documents remain
    // the authoritative source immediately after the employee is created.
    initialContract: contracts[0]
      ? {
          startDate: new Date(`${contracts[0].startDate}T00:00:00.000Z`),
          endDate: new Date(`${contracts[0].endDate}T00:00:00.000Z`),
        }
      : null,
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
    'missing-contract',
    'partial-contract',
    'invalid-contract-date',
    'invalid-contract-range',
    'duplicate-contract',
    'overlapping-contract',
    'ambiguous-contract-match',
    'invalid-shift',
    'invalid-citizenship',
    'invalid-gender',
    'invalid-first-toyota-employment-date',
    'invalid-medical-examination-date',
    'invalid-medical-valid-until',
    'invalid-medical-date-range',
    'invalid-medical-type',
  ];
  return warnings.some((warning) => blockingWarnings.includes(warning))
    ? 'blocked'
    : 'new';
}

function resolveBulkUpdateStatus(
  warnings: readonly EmployeeTemplateWarningCode[],
  changes: readonly BulkEmployeeUpdateChange[],
  contractChanges: readonly BulkEmployeeContractChange[],
): BulkEmployeeUpdateStatus {
  const blockingWarnings: EmployeeTemplateWarningCode[] = [
    'missing-teta',
    'unknown-teta',
    'ambiguous-teta',
    'name-mismatch',
    'identity-conflict',
    'invalid-citizenship',
    'invalid-gender',
    'invalid-first-toyota-employment-date',
    'partial-contract',
    'invalid-contract-date',
    'invalid-contract-range',
    'duplicate-contract',
    'overlapping-contract',
    'ambiguous-contract-match',
    'invalid-shift',
    'invalid-shift-for-department',
    'invalid-medical-examination-date',
    'invalid-medical-valid-until',
    'invalid-medical-date-range',
    'invalid-medical-type',
  ];
  if (warnings.some((warning) => blockingWarnings.includes(warning))) {
    return 'blocked';
  }
  const hasContractMutation = contractChanges.some(
    (change) => change.kind === 'create' || change.kind === 'update',
  );
  if (changes.length === 0 && !hasContractMutation) {
    return 'no-changes';
  }
  return warnings.length > 0 ? 'warning' : 'ready';
}

function employeeToTemplateRow(employee: Employee): string[] {
  const values = new Map<EmployeeTemplateColumn, string>([
    ['Numer TETA', employee.tetaNumber],
    ['Imię', employee.firstName],
    ['Nazwisko', employee.lastName],
  ]);
  activeContracts(employee)
    .slice(0, CONTRACT_SLOT_COUNT)
    .forEach((contract, index) => {
      values.set(contractColumn(index + 1, 'od'), contract.startDate);
      values.set(contractColumn(index + 1, 'do'), contract.endDate ?? '');
    });
  return employeeTemplateHeaders.map((header) => values.get(header) ?? '');
}

function employeeToUpdateInput(employee: Employee): EmployeeCreateInput {
  return {
    tetaNumber: employee.tetaNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    pesel: employee.pesel,
    passportNumber: employee.passportNumber,
    foreignDocumentNumber: employee.foreignDocumentNumber,
    phoneNumber: employee.phoneNumber,
    isActive: employee.isActive,
    departmentId: employee.departmentId,
    shiftAssignment: employee.shiftAssignment,
    initialContract: null,
    citizenship: employee.citizenship,
    gender: employee.gender,
    firstToyotaEmploymentDate: employee.firstToyotaEmploymentDate,
    medicalExaminationDate: employee.medicalExaminationDate,
    medicalValidUntil: employee.medicalValidUntil,
    medicalExaminationType: employee.medicalExaminationType,
  };
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

function applyPhoneUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
) {
  const raw = normalizeImportText(row.values['Numer telefonu']);
  if (!raw) return;
  const value =
    raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER ? null : normalizePhoneNumber(raw);
  if (value === (employee.phoneNumber ?? null)) return;
  updateInput.phoneNumber = value;
  changes.push({
    field: 'phoneNumber',
    label: 'Numer telefonu',
    oldValue: employee.phoneNumber ?? '',
    newValue: value ?? EMPLOYEE_TEMPLATE_CLEAR_MARKER,
  });
}

function applyCitizenshipUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
) {
  const raw = normalizeImportText(row.values['Obywatelstwo']);
  if (!raw) return;
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.citizenship) {
      updateInput.citizenship = null;
      changes.push({
        field: 'citizenship',
        label: 'Obywatelstwo',
        oldValue: employee.citizenship,
        newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
      });
    }
    return;
  }
  if (!isValidCitizenship(raw)) {
    warnings.push('invalid-citizenship');
    return;
  }
  const value = normalizeCitizenship(raw);
  if (value === (employee.citizenship ?? null)) return;
  updateInput.citizenship = value;
  changes.push({
    field: 'citizenship',
    label: 'Obywatelstwo',
    oldValue: employee.citizenship ?? '',
    newValue: value ?? '',
  });
}

function applyGenderUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
) {
  const raw = normalizeImportText(row.values['Płeć']);
  if (!raw) return;
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.gender) {
      updateInput.gender = null;
      changes.push({
        field: 'gender',
        label: 'Płeć',
        oldValue: employee.gender,
        newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
      });
    }
    return;
  }
  const value = normalizeEmployeeGender(raw);
  if (!value) {
    warnings.push('invalid-gender');
    return;
  }
  if (value === (employee.gender ?? null)) return;
  updateInput.gender = value;
  changes.push({
    field: 'gender',
    label: 'Płeć',
    oldValue: employee.gender ?? '',
    newValue: value,
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
    | 'Data pierwszego zatrudnienia w Toyota'
    | 'Data badania lekarskiego'
    | 'Badanie ważne do'
  >,
  field: Extract<
    keyof EmployeeCreateInput,
    'firstToyotaEmploymentDate' | 'medicalExaminationDate' | 'medicalValidUntil'
  >,
  invalidWarning: Extract<
    EmployeeTemplateWarningCode,
    | 'invalid-first-toyota-employment-date'
    | 'invalid-medical-examination-date'
    | 'invalid-medical-valid-until'
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
  if (formatImportDate(oldValue ?? null) === formatImportDate(value)) {
    return;
  }
  updateInput[field] = value;
  changes.push({
    field,
    label: column,
    oldValue: formatImportDate(oldValue ?? null),
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
    updateInput.assignmentEffectiveDate = currentLocalIsoDate();
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
  departments: readonly Department[],
) {
  const raw = normalizeImportText(row.values['Grupa zmianowa']);
  if (!raw) {
    return;
  }
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.shiftAssignment) {
      updateInput.shiftAssignment = null;
      changes.push({
        field: 'shiftAssignment',
        label: 'Grupa zmianowa',
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
  const department = departments.find(
    (candidate) => candidate.id === updateInput.departmentId,
  );
  if (shift === 'BLUE' && department?.shiftMode === 'TWO_SHIFT') {
    warnings.push('invalid-shift-for-department');
    return;
  }
  if (shift !== employee.shiftAssignment) {
    updateInput.shiftAssignment = shift;
    updateInput.assignmentEffectiveDate = currentLocalIsoDate();
    changes.push({
      field: 'shiftAssignment',
      label: 'Grupa zmianowa',
      oldValue: employee.shiftAssignment ?? '',
      newValue: shift,
    });
  }
}

function applyMedicalTypeUpdate(
  row: ParsedTemplateRow,
  employee: Employee,
  updateInput: EmployeeCreateInput,
  changes: BulkEmployeeUpdateChange[],
  warnings: EmployeeTemplateWarningCode[],
) {
  const raw = normalizeImportText(row.values['Typ badania lekarskiego']);
  if (!raw) return;
  if (raw === EMPLOYEE_TEMPLATE_CLEAR_MARKER) {
    if (employee.medicalExaminationType) {
      updateInput.medicalExaminationType = null;
      changes.push({
        field: 'medicalExaminationType',
        label: 'Typ badania lekarskiego',
        oldValue: medicalTypeTemplateLabel(employee.medicalExaminationType),
        newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
      });
    }
    return;
  }
  const value = normalizeMedicalExaminationType(raw);
  if (!value) {
    warnings.push('invalid-medical-type');
    return;
  }
  if (value === (employee.medicalExaminationType ?? null)) return;
  updateInput.medicalExaminationType = value;
  changes.push({
    field: 'medicalExaminationType',
    label: 'Typ badania lekarskiego',
    oldValue: employee.medicalExaminationType
      ? medicalTypeTemplateLabel(employee.medicalExaminationType)
      : '',
    newValue: medicalTypeTemplateLabel(value),
  });
}

function medicalTypeTemplateLabel(
  value: NonNullable<Employee['medicalExaminationType']>,
): string {
  return {
    PRODUKCJA: 'Pracownik produkcji',
    MAGAZYNIER: 'Magazynier',
    PRODUKCJA_HL_PU: 'Pracownik produkcji HL/PU',
  }[value];
}

function departmentNameForInput(
  input: EmployeeCreateInput,
  departments: readonly Department[],
): string | null {
  return (
    departments.find((department) => department.id === input.departmentId)
      ?.name ?? null
  );
}

function currentLocalIsoDate(today = new Date()): string {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasNameMismatch(row: ParsedTemplateRow, employee: Employee): boolean {
  const firstName = normalizeImportText(row.values['Imię']).toLocaleUpperCase(
    'pl-PL',
  );
  const lastName = normalizeImportText(
    row.values['Nazwisko'],
  ).toLocaleUpperCase('pl-PL');
  return (
    (Boolean(firstName) &&
      firstName !== employee.firstName.toLocaleUpperCase('pl-PL')) ||
    (Boolean(lastName) &&
      lastName !== employee.lastName.toLocaleUpperCase('pl-PL'))
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

function buildEmployeesByTeta(
  employees: readonly Employee[],
): Map<string, Employee[]> {
  const result = new Map<string, Employee[]>();
  employees.forEach((employee) => {
    const key = normalizeTetaNumber(employee.tetaNumber);
    if (!key) return;
    result.set(key, [...(result.get(key) ?? []), employee]);
  });
  return result;
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
