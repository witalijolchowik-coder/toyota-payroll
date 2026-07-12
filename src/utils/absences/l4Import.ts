import * as XLSX from 'xlsx';

import type {
  Absence,
  Employee,
  IsoDate,
  MonthId,
} from '../../types/firestore';
import {
  absenceRangesOverlap,
  isValidIsoDate,
  normalizeAbsenceCode,
} from './absenceRules';

export const L4_REPORT_SHEET_NAME = 'RAPORT TBPL';

export type L4ImportPreviewStatus =
  | 'ready'
  | 'confirm-manual'
  | 'duplicate'
  | 'overlap-review'
  | 'continuation-review'
  | 'unmatched'
  | 'ambiguous'
  | 'invalid'
  | 'future-start'
  | 'unsupported-type'
  | 'month-missing';

export interface L4ImportSourceRow {
  rowNumber: number;
  sourceName: string;
  absenceType: string;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  errors: string[];
}

export interface L4ImportPreviewRow extends L4ImportSourceRow {
  id: string;
  status: L4ImportPreviewStatus;
  employeeId: string | null;
  tetaNumber: string | null;
  matchedEmployeeName: string | null;
  candidateEmployeeIds: string[];
  ownerMonthId: MonthId | null;
  message: string;
}

export interface L4ImportContext {
  employees: readonly Employee[];
  existingAbsences: readonly Absence[];
  existingMonthIds: ReadonlySet<MonthId>;
  today?: IsoDate;
}

const REQUIRED_HEADERS = {
  rowNumber: 'l.p.',
  sourceName: 'nazwisko i imię pracownika',
  absenceType: 'rodzaj nieobecności',
  startDate: 'data od',
  endDate: 'data do',
} as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('pl-PL')
    .replace(/\s+/g, ' ');
}

export function normalizeL4EmployeeName(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('pl-PL')
    .replace(/[,\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function employeeNameVariants(employee: Employee): string[] {
  return [
    normalizeL4EmployeeName(`${employee.lastName} ${employee.firstName}`),
    normalizeL4EmployeeName(`${employee.firstName} ${employee.lastName}`),
  ];
}

function excelSerialToIsoDate(value: number): IsoDate | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const utcMilliseconds = Math.round((value - 25569) * 86400 * 1000);
  const date = new Date(utcMilliseconds);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function parseL4DateCell(value: unknown): IsoDate | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    return excelSerialToIsoDate(value);
  }
  const text = String(value ?? '').trim();
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (!match) {
    return null;
  }
  const isoDate = `${match[3]}-${match[2]!.padStart(2, '0')}-${match[1]!.padStart(
    2,
    '0',
  )}`;
  return isValidIsoDate(isoDate) ? isoDate : null;
}

export function parseL4ReportWorkbook(
  buffer: ArrayBuffer,
): L4ImportSourceRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const worksheet = workbook.Sheets[L4_REPORT_SHEET_NAME];
  if (!worksheet) {
    throw new Error('missing-sheet');
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
    raw: true,
  });
  const header = rows[0] ?? [];
  const headerIndexes = new Map<string, number>();
  header.forEach((value, index) => {
    headerIndexes.set(normalizeHeader(value), index);
  });
  const indexes = Object.fromEntries(
    Object.entries(REQUIRED_HEADERS).map(([key, label]) => {
      const index = headerIndexes.get(label);
      if (index === undefined) {
        throw new Error(`missing-column:${label}`);
      }
      return [key, index];
    }),
  ) as Record<keyof typeof REQUIRED_HEADERS, number>;

  return rows
    .slice(1)
    .map((row, index): L4ImportSourceRow | null => {
      const sourceName = String(row[indexes.sourceName] ?? '').trim();
      const absenceType = String(row[indexes.absenceType] ?? '').trim();
      const startDate = parseL4DateCell(row[indexes.startDate]);
      const endDate = parseL4DateCell(row[indexes.endDate]);
      if (!sourceName && !absenceType && !startDate && !endDate) {
        return null;
      }
      const errors: string[] = [];
      if (!sourceName) errors.push('missing-name');
      if (!absenceType) errors.push('missing-type');
      if (!startDate) errors.push('invalid-start-date');
      if (!endDate) errors.push('invalid-end-date');
      if (startDate && endDate && endDate < startDate) {
        errors.push('invalid-date-range');
      }
      return {
        rowNumber: index + 2,
        sourceName,
        absenceType,
        startDate,
        endDate,
        errors,
      };
    })
    .filter((row): row is L4ImportSourceRow => Boolean(row));
}

function isConsecutive(
  first: { startDate: IsoDate; endDate: IsoDate },
  second: {
    startDate: IsoDate;
    endDate: IsoDate;
  },
): boolean {
  const dayAfterFirst = new Date(`${first.endDate}T00:00:00.000Z`);
  dayAfterFirst.setUTCDate(dayAfterFirst.getUTCDate() + 1);
  const dayAfterSecond = new Date(`${second.endDate}T00:00:00.000Z`);
  dayAfterSecond.setUTCDate(dayAfterSecond.getUTCDate() + 1);
  return (
    dayAfterFirst.toISOString().slice(0, 10) === second.startDate ||
    dayAfterSecond.toISOString().slice(0, 10) === first.startDate
  );
}

function classifyMatchedL4Row(
  row: L4ImportSourceRow,
  employee: Employee,
  context: L4ImportContext,
): Pick<L4ImportPreviewRow, 'status' | 'message'> {
  if (!row.startDate || !row.endDate) {
    return { status: 'invalid', message: 'invalid-row' };
  }
  const today = context.today ?? new Date().toISOString().slice(0, 10);
  if (row.startDate > today) {
    return { status: 'future-start', message: 'future-start' };
  }
  const ownerMonthId = row.startDate.slice(0, 7);
  const existingForEmployee = context.existingAbsences.filter(
    (absence) => absence.employeeId === employee.id,
  );
  const activeExisting = existingForEmployee.filter(
    (absence) => absence.status === 'ACTIVE',
  );
  const importedExisting = activeExisting.filter(
    (absence) => absence.source === 'absence_import',
  );
  const manualL4Existing = activeExisting.filter(
    (absence) =>
      absence.source === 'manual' &&
      normalizeAbsenceCode(absence.absenceCode) === 'L4',
  );
  const exactImported = importedExisting.find(
    (absence) =>
      normalizeAbsenceCode(absence.absenceCode) === 'L4' &&
      absence.startDate === row.startDate &&
      absence.endDate === row.endDate,
  );
  if (exactImported) {
    return { status: 'duplicate', message: 'duplicate' };
  }
  const importedOverlap = importedExisting.find((absence) =>
    absenceRangesOverlap(absence, {
      startDate: row.startDate!,
      endDate: row.endDate!,
    }),
  );
  if (importedOverlap) {
    return { status: 'overlap-review', message: 'overlap-review' };
  }
  const manualMatch = manualL4Existing.find(
    (absence) =>
      absence.monthId === ownerMonthId &&
      (absenceRangesOverlap(absence, {
        startDate: row.startDate!,
        endDate: row.endDate!,
      }) ||
        isConsecutive(absence, {
          startDate: row.startDate!,
          endDate: row.endDate!,
        })),
  );
  if (manualMatch) {
    return { status: 'confirm-manual', message: 'confirm-manual' };
  }
  const activeNonL4Overlap = activeExisting.find(
    (absence) =>
      normalizeAbsenceCode(absence.absenceCode) !== 'L4' &&
      absenceRangesOverlap(absence, {
        startDate: row.startDate!,
        endDate: row.endDate!,
      }),
  );
  if (activeNonL4Overlap) {
    return { status: 'overlap-review', message: 'overlap-review' };
  }
  const consecutive = importedExisting.find(
    (absence) =>
      normalizeAbsenceCode(absence.absenceCode) === 'L4' &&
      isConsecutive(absence, {
        startDate: row.startDate!,
        endDate: row.endDate!,
      }),
  );
  if (consecutive) {
    return {
      status: 'continuation-review',
      message: 'continuation-review',
    };
  }
  if (!context.existingMonthIds.has(ownerMonthId)) {
    return { status: 'month-missing', message: 'month-missing' };
  }
  return { status: 'ready', message: 'ready' };
}

export function buildL4ImportPreview(
  rows: readonly L4ImportSourceRow[],
  context: L4ImportContext,
): L4ImportPreviewRow[] {
  const employeeNameIndex = new Map<string, Employee[]>();
  context.employees.forEach((employee) => {
    employeeNameVariants(employee).forEach((name) => {
      const existing = employeeNameIndex.get(name) ?? [];
      if (!existing.some((candidate) => candidate.id === employee.id)) {
        employeeNameIndex.set(name, [...existing, employee]);
      }
    });
  });

  return rows.map((row): L4ImportPreviewRow => {
    const ownerMonthId = row.startDate ? row.startDate.slice(0, 7) : null;
    const id = `${row.rowNumber}:${row.sourceName}:${row.startDate ?? ''}`;
    if (row.errors.length > 0) {
      return {
        ...row,
        id,
        status: 'invalid',
        employeeId: null,
        tetaNumber: null,
        matchedEmployeeName: null,
        candidateEmployeeIds: [],
        ownerMonthId,
        message: row.errors[0] ?? 'invalid-row',
      };
    }
    if (normalizeAbsenceCode(row.absenceType) !== 'L4') {
      return {
        ...row,
        id,
        status: 'unsupported-type',
        employeeId: null,
        tetaNumber: null,
        matchedEmployeeName: null,
        candidateEmployeeIds: [],
        ownerMonthId,
        message: 'unsupported-type',
      };
    }
    const candidates =
      employeeNameIndex.get(normalizeL4EmployeeName(row.sourceName)) ?? [];
    if (candidates.length === 0) {
      return {
        ...row,
        id,
        status: 'unmatched',
        employeeId: null,
        tetaNumber: null,
        matchedEmployeeName: null,
        candidateEmployeeIds: [],
        ownerMonthId,
        message: 'unmatched',
      };
    }
    if (candidates.length > 1) {
      return {
        ...row,
        id,
        status: 'ambiguous',
        employeeId: null,
        tetaNumber: null,
        matchedEmployeeName: null,
        candidateEmployeeIds: candidates.map((employee) => employee.id),
        ownerMonthId,
        message: 'ambiguous',
      };
    }
    const employee = candidates[0]!;
    const classification = classifyMatchedL4Row(row, employee, context);
    return {
      ...row,
      id,
      ...classification,
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      matchedEmployeeName: `${employee.lastName} ${employee.firstName}`,
      candidateEmployeeIds: [employee.id],
      ownerMonthId,
    };
  });
}

export function resolveL4ImportPreviewRow(
  row: L4ImportPreviewRow,
  employeeId: string,
  context: L4ImportContext,
): L4ImportPreviewRow {
  const employee = context.employees.find(
    (candidate) => candidate.id === employeeId,
  );
  if (!employee) {
    return row;
  }
  const classification = classifyMatchedL4Row(row, employee, context);
  return {
    ...row,
    ...classification,
    employeeId: employee.id,
    tetaNumber: employee.tetaNumber,
    matchedEmployeeName: `${employee.lastName} ${employee.firstName}`,
    candidateEmployeeIds: [employee.id],
  };
}

export function l4RowsToCreate(rows: readonly L4ImportPreviewRow[]) {
  return rows.filter(
    (row) =>
      (row.status === 'ready' || row.status === 'confirm-manual') &&
      row.employeeId &&
      row.tetaNumber &&
      row.startDate &&
      row.endDate &&
      row.ownerMonthId,
  );
}
