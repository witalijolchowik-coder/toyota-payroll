import type {
  Employee,
  EmployeeCitizenship,
  IsoDate,
} from '../../types/firestore';
import { isDateCoveredByContracts } from '../employees';

export const BASE_SALARY_TIERS = {
  throughSeptember2025: 5464,
  october2025ThroughMarch2026: 5279,
  fromApril2026: 5160,
} as const;

export type EmployeeDocumentIssue =
  'missing-citizenship' | 'missing-pesel' | 'missing-passport';

function isoDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

export function isEmployeeActiveOnDate(
  employee: Pick<Employee, 'contracts'>,
  date: Date,
): boolean {
  return isDateCoveredByContracts(employee, isoDate(date));
}

export function hasCurrentStatusConflict(
  employee: Pick<Employee, 'contracts' | 'isActive'>,
  today: Date,
): boolean {
  return employee.isActive !== isEmployeeActiveOnDate(employee, today);
}

export function requiredEmployeeDocumentIssues({
  citizenship,
  pesel,
  passportNumber,
}: {
  citizenship?: EmployeeCitizenship | null;
  pesel?: string | null;
  passportNumber?: string | null;
}): EmployeeDocumentIssue[] {
  const issues: EmployeeDocumentIssue[] = [];
  if (!citizenship) {
    issues.push('missing-citizenship');
  }
  if (!pesel?.trim()) {
    issues.push('missing-pesel');
  }
  if (citizenship && citizenship !== 'PL' && !passportNumber?.trim()) {
    issues.push('missing-passport');
  }
  return issues;
}

export function baseSalaryForFirstToyotaEmploymentDate(
  firstEmploymentDate: Date | null | undefined,
): number | null {
  if (!firstEmploymentDate) {
    return null;
  }
  const date = isoDate(firstEmploymentDate);
  if (date <= '2025-09-30') {
    return BASE_SALARY_TIERS.throughSeptember2025;
  }
  if (date <= '2026-03-31') {
    return BASE_SALARY_TIERS.october2025ThroughMarch2026;
  }
  return BASE_SALARY_TIERS.fromApril2026;
}

export function preserveFirstToyotaEmploymentDate(
  existing: Date | null | undefined,
  submitted: Date | null | undefined,
): Date | null {
  return existing ?? submitted ?? null;
}
