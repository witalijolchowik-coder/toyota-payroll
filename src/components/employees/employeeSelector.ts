import type { Employee } from '../../types/firestore';

export type EmployeeSelectorOption = Pick<
  Employee,
  'id' | 'tetaNumber' | 'firstName' | 'lastName'
>;

const employeeCollator = new Intl.Collator('pl', {
  sensitivity: 'base',
  numeric: true,
});

export function formatEmployeeSelectorLabel(
  employee: EmployeeSelectorOption,
): string {
  return `${employee.lastName} ${employee.firstName} (${employee.tetaNumber})`;
}

export function normalizeEmployeeSelectorText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .trim()
    .replace(/\s+/g, ' ');
}

export function compareEmployeeSelectorOptions(
  left: EmployeeSelectorOption,
  right: EmployeeSelectorOption,
): number {
  return (
    employeeCollator.compare(left.lastName, right.lastName) ||
    employeeCollator.compare(left.firstName, right.firstName) ||
    employeeCollator.compare(left.tetaNumber, right.tetaNumber) ||
    employeeCollator.compare(left.id, right.id)
  );
}

export function sortEmployeeSelectorOptions<T extends EmployeeSelectorOption>(
  employees: readonly T[],
): T[] {
  return [...employees].sort(compareEmployeeSelectorOptions);
}

function matchRank(employee: EmployeeSelectorOption, query: string): number {
  const lastName = normalizeEmployeeSelectorText(employee.lastName);
  const firstName = normalizeEmployeeSelectorText(employee.firstName);
  const tetaNumber = normalizeEmployeeSelectorText(employee.tetaNumber);
  const fields = [lastName, firstName, tetaNumber];
  const tokens = query.split(' ');

  if (!tokens.every((token) => fields.some((field) => field.includes(token)))) {
    return Number.POSITIVE_INFINITY;
  }

  const surnameFirst = `${lastName} ${firstName}`;
  const firstNameFirst = `${firstName} ${lastName}`;
  if (
    surnameFirst.startsWith(query) ||
    firstNameFirst.startsWith(query) ||
    tetaNumber.startsWith(query)
  ) {
    return 0;
  }

  if (
    tokens.every((token) => fields.some((field) => field.startsWith(token)))
  ) {
    return 1;
  }

  return 2;
}

export function filterEmployeeSelectorOptions<T extends EmployeeSelectorOption>(
  employees: readonly T[],
  inputValue: string,
): T[] {
  const query = normalizeEmployeeSelectorText(inputValue);
  if (!query) return sortEmployeeSelectorOptions(employees);

  return employees
    .map((employee) => ({ employee, rank: matchRank(employee, query) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareEmployeeSelectorOptions(left.employee, right.employee),
    )
    .map(({ employee }) => employee);
}
