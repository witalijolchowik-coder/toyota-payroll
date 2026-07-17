import type {
  Absence,
  Department,
  Employee,
  EmployeeEntitlement,
  IsoDate,
} from '../../types/firestore';
import {
  absenceCoversDate,
  deriveL4BusinessStatus,
  resolveGoverningAbsence,
} from '../../utils/absences';
import { aggregateMedicalNotices } from '../../utils/employees';
import { dateToIsoDate, isEmployeeActiveOnDate } from '../../utils/payroll';
import type { MonthReadinessSummary } from '../../utils/readiness';

export interface DashboardDeadline {
  employee: Employee;
  date: Date;
  kind: 'contract' | 'medical';
}

export interface DashboardDepartmentSummary {
  id: string;
  name: string;
  activeEmployees: number;
  presentEmployees: number;
  employeesOnL4Today: number;
  otherAbsentEmployees: number;
  shiftGroups: {
    red: number;
    white: number;
    blue: number;
    unassigned: number;
  };
}

export interface DashboardAbsenceTrendDay {
  date: Date;
  l4: number;
  vacation: number;
  total: number;
}

export interface DashboardSnapshot {
  activeEmployees: Employee[];
  citizenship: {
    polish: number;
    foreign: number;
    missing: number;
  };
  confirmedL4EmployeeIds: Set<string>;
  confirmedL4Today: number;
  unconfirmedL4: number;
  expiringContracts: Employee[];
  medicalRenewals: Employee[];
  expiredMedical: Employee[];
  missingEmployeeData: number;
  departmentSummaries: DashboardDepartmentSummary[];
  accommodation: {
    company: number;
    ownHousing: number;
  };
  absenceTrend: DashboardAbsenceTrendDay[];
  deadlines: DashboardDeadline[];
}

interface DashboardSnapshotInput {
  employees: readonly Employee[];
  departments: readonly Department[];
  entitlements: readonly EmployeeEntitlement[];
  selectedMonthAbsences: readonly Absence[];
  currentAbsences: readonly Absence[];
  readiness: MonthReadinessSummary | null;
  today?: Date;
}

const DEADLINE_WINDOW_DAYS = 30;

export function buildDashboardSnapshot({
  employees,
  departments,
  entitlements,
  selectedMonthAbsences,
  currentAbsences,
  readiness,
  today = new Date(),
}: DashboardSnapshotInput): DashboardSnapshot {
  const todayIso = dateToIsoDate(today);
  const deadlineEnd = addCalendarDays(today, DEADLINE_WINDOW_DAYS);
  const activeEmployees = employees.filter((employee) =>
    isEmployeeActiveOnDate(employee, today),
  );
  const activeEmployeeIds = new Set(
    activeEmployees.map((employee) => employee.id),
  );
  const confirmedL4EmployeeIds = new Set(
    currentAbsences
      .filter(
        (absence) =>
          activeEmployeeIds.has(absence.employeeId) &&
          absenceCoversDate(absence, todayIso) &&
          deriveL4BusinessStatus(absence, todayIso) === 'ACTIVE',
      )
      .map((absence) => absence.employeeId),
  );
  const todayResolutions = buildAbsenceResolutions(currentAbsences, todayIso);
  const absentEmployeeIds = new Set(
    [...todayResolutions.entries()]
      .filter(
        ([employeeId, resolution]) =>
          activeEmployeeIds.has(employeeId) && resolution.kind !== 'none',
      )
      .map(([employeeId]) => employeeId),
  );
  const unconfirmedL4 = new Set(
    selectedMonthAbsences
      .filter(
        (absence) =>
          absence.status === 'ACTIVE' &&
          deriveL4BusinessStatus(absence, todayIso) === 'REPORTED',
      )
      .map((absence) => absence.employeeId),
  ).size;
  const expiringContracts = activeEmployees
    .filter(
      (employee) =>
        employee.employmentEndDate &&
        isDateInRange(employee.employmentEndDate, today, deadlineEnd),
    )
    .sort(compareEmploymentEnd);
  const medical = aggregateMedicalNotices(activeEmployees, departments, today);
  const medicalRenewals = uniqueEmployees([
    ...medical.expired,
    ...medical.expiringSoon,
  ]);
  const missingEmployeeData = new Set(
    readiness?.issues
      .filter(
        (issue) =>
          issue.severity === 'blocking' &&
          issue.target === 'employees' &&
          issue.employeeId,
      )
      .map((issue) => issue.employeeId!) ?? [],
  ).size;
  const departmentsById = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const departmentSummaries = buildDepartmentSummaries(
    activeEmployees,
    departmentsById,
    confirmedL4EmployeeIds,
    absentEmployeeIds,
  );
  const activeEntitlements = entitlements.filter(
    (entitlement) =>
      activeEmployeeIds.has(entitlement.employeeId) &&
      entitlement.status === 'ACTIVE' &&
      entitlement.validFrom <= todayIso &&
      (!entitlement.validTo || entitlement.validTo >= todayIso),
  );
  const upcomingMedical = medical.expiringSoon
    .filter(
      (employee) =>
        employee.medicalValidUntil &&
        isDateInRange(employee.medicalValidUntil, today, deadlineEnd),
    )
    .map((employee): DashboardDeadline => ({
      employee,
      date: employee.medicalValidUntil!,
      kind: 'medical',
    }));
  const deadlines = [
    ...expiringContracts.map((employee): DashboardDeadline => ({
      employee,
      date: employee.employmentEndDate!,
      kind: 'contract',
    })),
    ...upcomingMedical,
  ]
    .sort((first, second) => first.date.getTime() - second.date.getTime())
    .slice(0, 6);

  return {
    activeEmployees,
    citizenship: {
      polish: activeEmployees.filter(
        (employee) => employee.citizenship === 'PL',
      ).length,
      foreign: activeEmployees.filter(
        (employee) =>
          Boolean(employee.citizenship) && employee.citizenship !== 'PL',
      ).length,
      missing: activeEmployees.filter((employee) => !employee.citizenship)
        .length,
    },
    confirmedL4EmployeeIds,
    confirmedL4Today: confirmedL4EmployeeIds.size,
    unconfirmedL4,
    expiringContracts,
    medicalRenewals,
    expiredMedical: medical.expired,
    missingEmployeeData,
    departmentSummaries,
    accommodation: {
      company: countEntitlements(activeEntitlements, 'COMPANY_ACCOMMODATION'),
      ownHousing: countEntitlements(
        activeEntitlements,
        'OWN_HOUSING_ALLOWANCE',
      ),
    },
    absenceTrend: buildAbsenceTrend(employees, currentAbsences, today),
    deadlines,
  };
}

function buildDepartmentSummaries(
  employees: readonly Employee[],
  departmentsById: ReadonlyMap<string, string>,
  confirmedL4EmployeeIds: ReadonlySet<string>,
  absentEmployeeIds: ReadonlySet<string>,
): DashboardDepartmentSummary[] {
  const groups = new Map<string, DashboardDepartmentSummary>();
  employees.forEach((employee) => {
    const id = employee.departmentId ?? 'unassigned';
    const group = groups.get(id) ?? {
      id,
      name: employee.departmentId
        ? (departmentsById.get(employee.departmentId) ?? employee.departmentId)
        : '',
      activeEmployees: 0,
      presentEmployees: 0,
      employeesOnL4Today: 0,
      otherAbsentEmployees: 0,
      shiftGroups: {
        red: 0,
        white: 0,
        blue: 0,
        unassigned: 0,
      },
    };
    group.activeEmployees += 1;
    if (confirmedL4EmployeeIds.has(employee.id)) {
      group.employeesOnL4Today += 1;
    } else if (absentEmployeeIds.has(employee.id)) {
      group.otherAbsentEmployees += 1;
    } else {
      group.presentEmployees += 1;
    }
    if (employee.shiftAssignment === 'RED') {
      group.shiftGroups.red += 1;
    } else if (employee.shiftAssignment === 'WHITE') {
      group.shiftGroups.white += 1;
    } else if (employee.shiftAssignment === 'BLUE') {
      group.shiftGroups.blue += 1;
    } else {
      group.shiftGroups.unassigned += 1;
    }
    groups.set(id, group);
  });
  return [...groups.values()].sort(
    (first, second) =>
      second.activeEmployees - first.activeEmployees ||
      first.name.localeCompare(second.name, 'pl-PL'),
  );
}

function buildAbsenceTrend(
  employees: readonly Employee[],
  absences: readonly Absence[],
  today: Date,
): DashboardAbsenceTrendDay[] {
  return Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(today, index - 6),
  ).map((date) => {
    const dateIso = dateToIsoDate(date);
    const activeEmployeeIds = new Set(
      employees
        .filter((employee) => isEmployeeActiveOnDate(employee, date))
        .map((employee) => employee.id),
    );
    const resolutions = buildAbsenceResolutions(absences, dateIso);
    let l4 = 0;
    let vacation = 0;

    resolutions.forEach((resolution, employeeId) => {
      if (
        !activeEmployeeIds.has(employeeId) ||
        resolution.kind !== 'governed'
      ) {
        return;
      }
      if (resolution.code === 'L4' && resolution.confirmation === 'confirmed') {
        l4 += 1;
      } else if (resolution.code === 'UW' || resolution.code === 'UZ') {
        vacation += 1;
      }
    });

    return { date, l4, vacation, total: l4 + vacation };
  });
}

function buildAbsenceResolutions(absences: readonly Absence[], date: IsoDate) {
  const byEmployee = new Map<string, Absence[]>();
  absences.forEach((absence) => {
    if (absence.status !== 'ACTIVE' || !absenceCoversDate(absence, date)) {
      return;
    }
    const employeeAbsences = byEmployee.get(absence.employeeId) ?? [];
    employeeAbsences.push(absence);
    byEmployee.set(absence.employeeId, employeeAbsences);
  });
  return new Map(
    [...byEmployee.entries()].map(([employeeId, employeeAbsences]) => [
      employeeId,
      resolveGoverningAbsence(employeeAbsences, date),
    ]),
  );
}

function countEntitlements(
  entitlements: readonly EmployeeEntitlement[],
  type: EmployeeEntitlement['type'],
) {
  return new Set(
    entitlements
      .filter((entitlement) => entitlement.type === type)
      .map((entitlement) => entitlement.employeeId),
  ).size;
}

function uniqueEmployees(employees: readonly Employee[]): Employee[] {
  return employees.filter(
    (employee, index, all) =>
      all.findIndex((candidate) => candidate.id === employee.id) === index,
  );
}

function compareEmploymentEnd(first: Employee, second: Employee) {
  return (
    (first.employmentEndDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (second.employmentEndDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );
}

function isDateInRange(value: Date, start: Date, end: Date): boolean {
  const day = dateAtUtcMidnight(value);
  return day >= dateAtUtcMidnight(start) && day <= dateAtUtcMidnight(end);
}

function addCalendarDays(value: Date, days: number): Date {
  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate() + days),
  );
}

function dateAtUtcMidnight(value: Date): number {
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}
