import type {
  Department,
  Employee,
  EmployeeAssignment,
  IsoDate,
} from '../../types/firestore';
import { CANONICAL_DEPARTMENTS } from '../../utils/organization';
import { resolveEffectiveAssignment } from '../../utils/schedule';

const canonicalDepartmentOrder = new Map(
  CANONICAL_DEPARTMENTS.map((department, index) => [department.id, index]),
);

export interface CalendarEmployeeRow {
  employee: Employee;
  departmentId: string | null;
  departmentLabel: string;
  isFirstInDepartment: boolean;
}

export function buildCalendarEmployeeRows({
  employees,
  departments,
  assignments,
  referenceDate,
  unassignedLabel,
}: {
  employees: readonly Employee[];
  departments: readonly Department[];
  assignments: readonly EmployeeAssignment[];
  referenceDate: IsoDate;
  unassignedLabel: string;
}): CalendarEmployeeRow[] {
  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const rows = employees.map((employee) => {
    const assignment = resolveEffectiveAssignment(
      employee,
      referenceDate,
      assignments,
    );
    const departmentId = assignment.departmentId ?? employee.departmentId;
    return {
      employee,
      departmentId,
      departmentLabel: departmentId
        ? (departmentNames.get(departmentId) ?? departmentId)
        : unassignedLabel,
    };
  });

  rows.sort((first, second) => {
    const departmentComparison =
      departmentRank(first.departmentId) - departmentRank(second.departmentId);
    if (departmentComparison !== 0) return departmentComparison;
    return (
      first.employee.lastName.localeCompare(second.employee.lastName, 'pl-PL', {
        sensitivity: 'base',
      }) ||
      first.employee.firstName.localeCompare(
        second.employee.firstName,
        'pl-PL',
        {
          sensitivity: 'base',
        },
      ) ||
      first.employee.id.localeCompare(second.employee.id)
    );
  });

  return rows.map((row, index) => ({
    ...row,
    isFirstInDepartment:
      index === 0 || rows[index - 1]!.departmentId !== row.departmentId,
  }));
}

function departmentRank(departmentId: string | null): number {
  if (!departmentId) return Number.MAX_SAFE_INTEGER;
  return (
    canonicalDepartmentOrder.get(departmentId) ?? CANONICAL_DEPARTMENTS.length
  );
}
