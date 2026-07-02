import type { IsoDate, MonthId } from '../../types/firestore';

const MONTH_ID_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function assertPathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes('/')) {
    throw new Error(`${label} must be a non-empty Firestore path segment.`);
  }
  return normalized;
}

export function assertMonthId(value: string): asserts value is MonthId {
  if (!MONTH_ID_PATTERN.test(value)) {
    throw new Error('monthId must use the YYYY-MM format.');
  }
}

export function assertIsoDate(value: string): asserts value is IsoDate {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error('date must use the YYYY-MM-DD format.');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('date must be a valid calendar date.');
  }
}

export function dailyValueDocumentId(employeeId: string, date: string): string {
  const safeEmployeeId = assertPathSegment(employeeId, 'employeeId');
  assertIsoDate(date);
  return `${safeEmployeeId}_${date}`;
}

export const firestorePaths = {
  employees: 'employees',
  employee(employeeId: string) {
    return `employees/${assertPathSegment(employeeId, 'employeeId')}`;
  },
  months: 'months',
  month(monthId: string) {
    assertMonthId(monthId);
    return `months/${monthId}`;
  },
  employeeSettlements(monthId: string) {
    return `${this.month(monthId)}/employeeSettlements`;
  },
  dailyValues(monthId: string) {
    return `${this.month(monthId)}/dailyValues`;
  },
  absences(monthId: string) {
    return `${this.month(monthId)}/absences`;
  },
  adjustments(monthId: string) {
    return `${this.month(monthId)}/adjustments`;
  },
  imports(monthId: string) {
    return `${this.month(monthId)}/imports`;
  },
  reports: 'reports',
  report(reportId: string) {
    return `reports/${assertPathSegment(reportId, 'reportId')}`;
  },
  auditLog: 'auditLog',
  auditEntry(entryId: string) {
    return `auditLog/${assertPathSegment(entryId, 'entryId')}`;
  },
} as const;
