import type { Department, Employee } from '../../types/firestore';
import { resolveCurrentEmploymentPeriod } from '../../utils/employees';
import { dateToIsoDate, isEmployeeActiveOnDate } from '../../utils/payroll';

export type EmployeeListMode = 'active' | 'archive';
export type EmployeeSortKey =
  | 'teta'
  | 'employee'
  | 'department'
  | 'shift'
  | 'firstEmployment'
  | 'currentContract';
export type SortDirection = 'asc' | 'desc';

export interface EmployeeSortState {
  key: EmployeeSortKey;
  direction: SortDirection;
}

const departmentOrder = [
  'Metal',
  'Szwalnia',
  'Montaż',
  'PU',
  'Headliner',
  'Magazyn',
];
const shiftOrder = ['RED', 'WHITE', 'BLUE'];

export function employeeMatchesListMode(
  employee: Employee,
  mode: EmployeeListMode,
  today: Date,
): boolean {
  if (mode === 'active') {
    return isEmployeeActiveOnDate(employee, today);
  }
  return Boolean(
    employee.employmentEndDate &&
    dateToIsoDate(employee.employmentEndDate) < dateToIsoDate(today),
  );
}

export function nextEmployeeSort(
  current: EmployeeSortState,
  key: EmployeeSortKey,
): EmployeeSortState {
  return {
    key,
    direction:
      current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  };
}

export function sortEmployees(
  employees: readonly Employee[],
  departments: readonly Department[],
  sort: EmployeeSortState,
): Employee[] {
  const names = new Map(departments.map((item) => [item.id, item.name]));
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...employees].sort((first, second) => {
    if (sort.key === 'firstEmployment') {
      return (
        compareOptionalDates(
          first.firstToyotaEmploymentDate,
          second.firstToyotaEmploymentDate,
          sort.direction,
        ) || compareEmployeeName(first, second)
      );
    }
    if (sort.key === 'currentContract') {
      return (
        compareCurrentContracts(first, second, sort.direction) ||
        compareEmployeeName(first, second)
      );
    }
    if (sort.key === 'shift') {
      return (
        compareDepartment(first, second, names) ||
        compareOrdered(
          first.shiftAssignment,
          second.shiftAssignment,
          shiftOrder,
        ) * multiplier ||
        compareEmployeeName(first, second)
      );
    }
    const comparison =
      sort.key === 'teta'
        ? logicalTeta(first.tetaNumber, second.tetaNumber)
        : sort.key === 'employee'
          ? compareEmployeeName(first, second)
          : compareDepartment(first, second, names);
    return comparison * multiplier || compareEmployeeName(first, second);
  });
}

function compareEmployeeName(first: Employee, second: Employee): number {
  return (
    first.lastName.localeCompare(second.lastName, 'pl-PL', {
      sensitivity: 'base',
    }) ||
    first.firstName.localeCompare(second.firstName, 'pl-PL', {
      sensitivity: 'base',
    })
  );
}

function compareDepartment(
  first: Employee,
  second: Employee,
  names: ReadonlyMap<string, string>,
): number {
  return compareOrdered(
    first.departmentId ? names.get(first.departmentId) : null,
    second.departmentId ? names.get(second.departmentId) : null,
    departmentOrder,
  );
}

function compareOrdered(
  first: string | null | undefined,
  second: string | null | undefined,
  order: readonly string[],
): number {
  const rank = (value: string | null | undefined) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const index = order.findIndex(
      (item) =>
        item.localeCompare(value, 'pl-PL', { sensitivity: 'base' }) === 0,
    );
    return index === -1 ? order.length : index;
  };
  return (
    rank(first) - rank(second) ||
    (first ?? '').localeCompare(second ?? '', 'pl-PL')
  );
}

function logicalTeta(first: string, second: string): number {
  return first.localeCompare(second, 'pl-PL', {
    numeric: true,
    sensitivity: 'base',
  });
}

function compareOptionalDates(
  first: Date | null | undefined,
  second: Date | null | undefined,
  direction: SortDirection,
): number {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  return (first.getTime() - second.getTime()) * (direction === 'asc' ? 1 : -1);
}

function compareCurrentContracts(
  first: Employee,
  second: Employee,
  direction: SortDirection,
): number {
  const firstPeriod = resolveCurrentEmploymentPeriod(first);
  const secondPeriod = resolveCurrentEmploymentPeriod(second);
  const firstRank = contractSortRank(firstPeriod);
  const secondRank = contractSortRank(secondPeriod);

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }
  if (!firstPeriod || !secondPeriod) {
    return 0;
  }
  if (firstPeriod.endDate && secondPeriod.endDate) {
    return compareOptionalDates(
      firstPeriod.endDate,
      secondPeriod.endDate,
      direction,
    );
  }
  return compareOptionalDates(
    firstPeriod.startDate,
    secondPeriod.startDate,
    direction,
  );
}

function contractSortRank(
  period: ReturnType<typeof resolveCurrentEmploymentPeriod>,
): number {
  if (!period) return 2;
  return period.endDate ? 0 : 1;
}
