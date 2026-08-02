import type { DepartmentId, Employee } from '../../types/firestore';
import {
  canonicalDepartmentOfficialName,
  canonicalDepartmentUiName,
  resolveCanonicalDepartment,
} from '../../utils/organization';

export const DEPARTMENT_ASSIGNMENT_EFFECTIVE_DATE = '2026-07-01' as const;
export const EXCLUDED_WORKFORCE_PERSON_KEY = 'OLKHOVYK VITALII';
export const DMYTRO_KARPETS_TETA = 'WT-07832507';

export interface DepartmentAssignmentSourceRow {
  rowNumber: number;
  employeeName: string;
  departmentName: string;
}

export interface BalanceTetaSourceRow {
  rowNumber: number;
  tetaNumber: string;
  firstName: string;
  lastName: string;
}

export type DepartmentAssignmentReconciliationStatus =
  | 'existing-unchanged'
  | 'existing-changed'
  | 'new-employee'
  | 'duplicate-source-row-ignored'
  | 'unresolved-teta'
  | 'conflicting-department'
  | 'excluded-non-worker'
  | 'missing-from-assignment-source'
  | 'ambiguous-legacy-metal'
  | 'legacy-department-migrated';

export interface DepartmentAssignmentReconciliationRow {
  id: string;
  status: DepartmentAssignmentReconciliationStatus;
  sourceRowNumber: number | null;
  employee: Employee | null;
  tetaNumber: string | null;
  firstName: string;
  lastName: string;
  sourceEmployeeName: string;
  currentDepartmentId: DepartmentId | null;
  targetDepartmentId: DepartmentId | null;
  targetUiName: string | null;
  targetOfficialName: string | null;
  details: string | null;
}

export interface DepartmentAssignmentReconciliation {
  assignmentRowCount: number;
  assignmentUniqueEmployeeCount: number;
  workforceEmployeeCount: number;
  rows: DepartmentAssignmentReconciliationRow[];
  counts: Record<DepartmentAssignmentReconciliationStatus, number>;
}

interface ResolvedSourceAssignment {
  sourceRowNumber: number | null;
  sourceEmployeeName: string;
  tetaNumber: string;
  firstName: string;
  lastName: string;
  targetDepartmentId: DepartmentId;
}

export function parseDepartmentAssignmentMatrix(
  matrix: readonly (readonly unknown[])[],
): DepartmentAssignmentSourceRow[] {
  const headerIndex = matrix.findIndex((row) => {
    const keys = row.map((cell) => normalizeMatchKey(cell));
    return keys.includes('NAZWISKO I IMIE') && keys.includes('NAZWA MPK');
  });
  if (headerIndex < 0) return [];

  const headers = matrix[headerIndex]!.map((cell) => normalizeMatchKey(cell));
  const nameIndex = headers.indexOf('NAZWISKO I IMIE');
  const departmentIndex = headers.indexOf('NAZWA MPK');

  return matrix.slice(headerIndex + 1).flatMap((row, index) => {
    const employeeName = normalizeDisplayText(row[nameIndex]);
    const departmentName = normalizeDisplayText(row[departmentIndex]);
    if (!employeeName && !departmentName) return [];
    return [
      {
        rowNumber: headerIndex + index + 2,
        employeeName,
        departmentName,
      },
    ];
  });
}

export function parseBalanceTetaMatrix(
  matrix: readonly (readonly unknown[])[],
): BalanceTetaSourceRow[] {
  const headerIndex = matrix.findIndex((row) => {
    const keys = row.map((cell) => normalizeMatchKey(cell));
    return (
      keys.some((key) => key === 'NR TETA' || key === 'NUMER TETA') &&
      keys.includes('NAZWISKO') &&
      keys.includes('IMIE')
    );
  });
  if (headerIndex < 0) return [];

  const headers = matrix[headerIndex]!.map((cell) => normalizeMatchKey(cell));
  const tetaIndex = headers.findIndex(
    (key) => key === 'NR TETA' || key === 'NUMER TETA',
  );
  const lastNameIndex = headers.indexOf('NAZWISKO');
  const firstNameIndex = headers.indexOf('IMIE');

  return matrix.slice(headerIndex + 1).flatMap((row, index) => {
    const tetaNumber = normalizeTetaNumber(row[tetaIndex]);
    const firstName = normalizeDisplayText(row[firstNameIndex]);
    const lastName = normalizeDisplayText(row[lastNameIndex]);
    if (!tetaNumber || !firstName || !lastName) return [];
    return [
      {
        rowNumber: headerIndex + index + 2,
        tetaNumber,
        firstName,
        lastName,
      },
    ];
  });
}

export function buildDepartmentAssignmentReconciliation({
  assignmentRows,
  balanceRows,
  existingEmployees,
}: {
  assignmentRows: readonly DepartmentAssignmentSourceRow[];
  balanceRows: readonly BalanceTetaSourceRow[];
  existingEmployees: readonly Employee[];
}): DepartmentAssignmentReconciliation {
  const rows: DepartmentAssignmentReconciliationRow[] = [];
  const balanceByName = indexBalanceRows(balanceRows);
  const existingByTeta = indexEmployeesByTeta(existingEmployees);
  const existingByName = indexEmployeesByName(existingEmployees);
  const groupedAssignments = groupAssignments(assignmentRows);
  const resolvedAssignments: ResolvedSourceAssignment[] = [];

  groupedAssignments.forEach((sourceRows) => {
    const first = sourceRows[0]!;
    const departmentIds = new Set(
      sourceRows.map((row) => resolvedDepartmentId(row.departmentName)),
    );
    if (departmentIds.size !== 1 || departmentIds.has(null)) {
      rows.push(
        reconciliationRow({
          status: 'conflicting-department',
          sourceRowNumber: first.rowNumber,
          sourceEmployeeName: first.employeeName,
          details: sourceRows.map((row) => row.departmentName).join(' / '),
        }),
      );
      return;
    }

    sourceRows.slice(1).forEach((duplicate) =>
      rows.push(
        reconciliationRow({
          status: 'duplicate-source-row-ignored',
          sourceRowNumber: duplicate.rowNumber,
          sourceEmployeeName: duplicate.employeeName,
          targetDepartmentId: [...departmentIds][0],
        }),
      ),
    );

    const personKey = normalizeMatchKey(first.employeeName);
    if (isExcludedWorkforcePerson(personKey)) {
      rows.push(
        reconciliationRow({
          status: 'excluded-non-worker',
          sourceRowNumber: first.rowNumber,
          sourceEmployeeName: first.employeeName,
          details: 'explicit-workforce-exclusion',
        }),
      );
      return;
    }

    const balanceMatches = balanceByName.get(personKey) ?? [];
    const specialTeta = isDmytroKarpets(personKey) ? DMYTRO_KARPETS_TETA : null;
    if (!specialTeta && balanceMatches.length !== 1) {
      rows.push(
        reconciliationRow({
          status: 'unresolved-teta',
          sourceRowNumber: first.rowNumber,
          sourceEmployeeName: first.employeeName,
          details:
            balanceMatches.length > 1 ? 'ambiguous-teta' : 'missing-teta',
        }),
      );
      return;
    }

    const balance = balanceMatches[0];
    const name = balance ?? splitSpecialName(first.employeeName);
    resolvedAssignments.push({
      sourceRowNumber: first.rowNumber,
      sourceEmployeeName: first.employeeName,
      tetaNumber: specialTeta ?? balance!.tetaNumber,
      firstName: name.firstName,
      lastName: name.lastName,
      targetDepartmentId: [...departmentIds][0]!,
    });
  });

  appendSpecialHeadlinerAssignments(
    resolvedAssignments,
    balanceRows,
    'MASLANY MAREK',
  );
  appendSpecialHeadlinerAssignments(
    resolvedAssignments,
    balanceRows,
    'WOJTALUK ROBERT',
  );

  const handledEmployeeIds = new Set<string>();
  const handledTetas = new Set<string>();
  resolvedAssignments.forEach((assignment) => {
    handledTetas.add(normalizeTetaNumber(assignment.tetaNumber));
    const tetaMatches =
      existingByTeta.get(normalizeTetaNumber(assignment.tetaNumber)) ?? [];
    const nameMatches =
      existingByName.get(
        normalizeMatchKey(`${assignment.lastName} ${assignment.firstName}`),
      ) ?? [];
    const candidates = tetaMatches.length > 0 ? tetaMatches : nameMatches;
    if (candidates.length > 1) {
      rows.push(
        reconciliationRow({
          ...assignment,
          status: 'unresolved-teta',
          details: 'ambiguous-existing-employee',
        }),
      );
      return;
    }

    const employee = candidates[0] ?? null;
    if (!employee) {
      rows.push(reconciliationRow({ ...assignment, status: 'new-employee' }));
      return;
    }

    handledEmployeeIds.add(employee.id);
    const status =
      employee.departmentId === assignment.targetDepartmentId
        ? 'existing-unchanged'
        : isOneToOneLegacyDepartment(
              employee.departmentId,
              assignment.targetDepartmentId,
            )
          ? 'legacy-department-migrated'
          : 'existing-changed';
    rows.push(reconciliationRow({ ...assignment, employee, status }));
  });

  balanceRows.forEach((balance) => {
    const key = normalizeMatchKey(`${balance.lastName} ${balance.firstName}`);
    if (isExcludedWorkforcePerson(key)) {
      rows.push(
        reconciliationRow({
          status: 'excluded-non-worker',
          sourceRowNumber: null,
          sourceEmployeeName: `${balance.lastName} ${balance.firstName}`,
          tetaNumber: balance.tetaNumber,
          firstName: balance.firstName,
          lastName: balance.lastName,
          details: 'explicit-workforce-exclusion',
        }),
      );
      return;
    }
    if (!handledTetas.has(normalizeTetaNumber(balance.tetaNumber))) {
      rows.push(
        reconciliationRow({
          status: 'missing-from-assignment-source',
          sourceRowNumber: null,
          sourceEmployeeName: `${balance.lastName} ${balance.firstName}`,
          tetaNumber: balance.tetaNumber,
          firstName: balance.firstName,
          lastName: balance.lastName,
        }),
      );
    }
  });

  existingEmployees.forEach((employee) => {
    if (handledEmployeeIds.has(employee.id)) return;
    const key = normalizeMatchKey(`${employee.lastName} ${employee.firstName}`);
    if (isExcludedWorkforcePerson(key)) return;
    const legacyResolution = resolveCanonicalDepartment(employee.departmentId);
    if (legacyResolution.status === 'ambiguous-legacy-metal') {
      rows.push(
        reconciliationRow({
          status: 'ambiguous-legacy-metal',
          sourceRowNumber: null,
          sourceEmployeeName: `${employee.lastName} ${employee.firstName}`,
          employee,
          details: 'manual-department-assignment-required',
        }),
      );
      return;
    }
    if (
      legacyResolution.status === 'matched' &&
      employee.departmentId !== legacyResolution.department.id
    ) {
      rows.push(
        reconciliationRow({
          status: 'legacy-department-migrated',
          sourceRowNumber: null,
          sourceEmployeeName: `${employee.lastName} ${employee.firstName}`,
          employee,
          targetDepartmentId: legacyResolution.department.id,
          details: 'safe-one-to-one-legacy-alias',
        }),
      );
    }
  });

  const counts = emptyCounts();
  rows.forEach((row) => {
    counts[row.status] += 1;
  });
  return {
    assignmentRowCount: assignmentRows.length,
    assignmentUniqueEmployeeCount: groupedAssignments.size,
    workforceEmployeeCount: resolvedAssignments.length,
    rows: rows.sort(compareReconciliationRows),
    counts,
  };
}

export function isApplicableDepartmentAssignmentRow(
  row: DepartmentAssignmentReconciliationRow,
): boolean {
  return (
    row.status === 'existing-changed' ||
    row.status === 'new-employee' ||
    row.status === 'legacy-department-migrated'
  );
}

export function isExcludedWorkforcePerson(value: string): boolean {
  const tokens = normalizeMatchKey(value).split(' ').filter(Boolean).sort();
  return tokens.join(' ') === 'OLKHOVYK VITALII';
}

function appendSpecialHeadlinerAssignments(
  assignments: ResolvedSourceAssignment[],
  balanceRows: readonly BalanceTetaSourceRow[],
  personKey: string,
) {
  if (
    assignments.some(
      (assignment) =>
        normalizeMatchKey(`${assignment.lastName} ${assignment.firstName}`) ===
        personKey,
    )
  ) {
    return;
  }
  const balance = balanceRows.find(
    (row) =>
      normalizeMatchKey(`${row.lastName} ${row.firstName}`) === personKey,
  );
  if (!balance) return;
  assignments.push({
    sourceRowNumber: null,
    sourceEmployeeName: `${balance.lastName} ${balance.firstName}`,
    tetaNumber: balance.tetaNumber,
    firstName: balance.firstName,
    lastName: balance.lastName,
    targetDepartmentId: 'headliner-bmw',
  });
}

function groupAssignments(rows: readonly DepartmentAssignmentSourceRow[]) {
  const grouped = new Map<string, DepartmentAssignmentSourceRow[]>();
  rows.forEach((row) => {
    const key = normalizeMatchKey(row.employeeName);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });
  return grouped;
}

function indexBalanceRows(rows: readonly BalanceTetaSourceRow[]) {
  const indexed = new Map<string, BalanceTetaSourceRow[]>();
  rows.forEach((row) => {
    [
      normalizeMatchKey(`${row.lastName} ${row.firstName}`),
      normalizeMatchKey(`${row.firstName} ${row.lastName}`),
    ].forEach((key) => {
      const current = indexed.get(key) ?? [];
      if (!current.includes(row)) current.push(row);
      indexed.set(key, current);
    });
  });
  return indexed;
}

function indexEmployeesByTeta(employees: readonly Employee[]) {
  const indexed = new Map<string, Employee[]>();
  employees.forEach((employee) => {
    const key = normalizeTetaNumber(employee.tetaNumber);
    const current = indexed.get(key) ?? [];
    current.push(employee);
    indexed.set(key, current);
  });
  return indexed;
}

function indexEmployeesByName(employees: readonly Employee[]) {
  const indexed = new Map<string, Employee[]>();
  employees.forEach((employee) => {
    [
      normalizeMatchKey(`${employee.lastName} ${employee.firstName}`),
      normalizeMatchKey(`${employee.firstName} ${employee.lastName}`),
    ].forEach((key) => {
      const current = indexed.get(key) ?? [];
      if (!current.includes(employee)) current.push(employee);
      indexed.set(key, current);
    });
  });
  return indexed;
}

function resolvedDepartmentId(value: string): DepartmentId | null {
  const resolution = resolveCanonicalDepartment(value);
  return resolution.status === 'matched' ? resolution.department.id : null;
}

function reconciliationRow(
  input: Partial<DepartmentAssignmentReconciliationRow> &
    Pick<DepartmentAssignmentReconciliationRow, 'status'>,
): DepartmentAssignmentReconciliationRow {
  const employee = input.employee ?? null;
  const targetDepartmentId = input.targetDepartmentId ?? null;
  const stableIdentity =
    input.sourceRowNumber ??
    employee?.id ??
    input.tetaNumber ??
    normalizeMatchKey(input.sourceEmployeeName ?? '') ??
    'unidentified';
  return {
    id: `${input.status}-${stableIdentity || 'unidentified'}`,
    status: input.status,
    sourceRowNumber: input.sourceRowNumber ?? null,
    employee,
    tetaNumber: input.tetaNumber ?? employee?.tetaNumber ?? null,
    firstName: input.firstName ?? employee?.firstName ?? '',
    lastName: input.lastName ?? employee?.lastName ?? '',
    sourceEmployeeName: input.sourceEmployeeName ?? '',
    currentDepartmentId: employee?.departmentId ?? null,
    targetDepartmentId,
    targetUiName: canonicalDepartmentUiName(targetDepartmentId),
    targetOfficialName: canonicalDepartmentOfficialName(targetDepartmentId),
    details: input.details ?? null,
  };
}

function isDmytroKarpets(value: string): boolean {
  return (
    normalizeMatchKey(value).split(' ').sort().join(' ') === 'DMYTRO KARPETS'
  );
}

function splitSpecialName(value: string): {
  firstName: string;
  lastName: string;
} {
  const tokens = normalizeDisplayText(value).split(' ').filter(Boolean);
  if (isDmytroKarpets(value)) {
    return { firstName: 'Dmytro', lastName: 'Karpets' };
  }
  return { firstName: tokens.at(-1) ?? '', lastName: tokens[0] ?? '' };
}

function isOneToOneLegacyDepartment(
  currentDepartmentId: string | null,
  targetDepartmentId: string,
): boolean {
  if (!currentDepartmentId || currentDepartmentId === 'metal') return false;
  const resolution = resolveCanonicalDepartment(currentDepartmentId);
  return (
    resolution.status === 'matched' &&
    resolution.department.id === targetDepartmentId &&
    currentDepartmentId !== targetDepartmentId
  );
}

function normalizeDisplayText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDepartmentAssignmentPersonName(
  value: unknown,
): string {
  return normalizeMatchKey(value);
}

function normalizeMatchKey(value: unknown): string {
  return normalizeDisplayText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeTetaNumber(value: unknown): string {
  return normalizeDisplayText(value).toUpperCase();
}

function emptyCounts(): Record<
  DepartmentAssignmentReconciliationStatus,
  number
> {
  return {
    'existing-unchanged': 0,
    'existing-changed': 0,
    'new-employee': 0,
    'duplicate-source-row-ignored': 0,
    'unresolved-teta': 0,
    'conflicting-department': 0,
    'excluded-non-worker': 0,
    'missing-from-assignment-source': 0,
    'ambiguous-legacy-metal': 0,
    'legacy-department-migrated': 0,
  };
}

function compareReconciliationRows(
  left: DepartmentAssignmentReconciliationRow,
  right: DepartmentAssignmentReconciliationRow,
): number {
  return (
    (left.sourceRowNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceRowNumber ?? Number.MAX_SAFE_INTEGER) ||
    left.sourceEmployeeName.localeCompare(right.sourceEmployeeName, 'pl-PL')
  );
}
