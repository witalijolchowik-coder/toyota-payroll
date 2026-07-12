import type {
  Department,
  Employee,
  EmployeeAssignment,
  EmployeeEntitlement,
  MonthId,
  PayrollMonth,
  PayrollSetting,
  ScheduleCorrection,
} from '../../types/firestore';
import { PAYROLL_SETTING_KEYS } from '../../types/firestore';
import {
  employeeEntitlementsOverlap,
  employeeParticipatesInPayrollMonth,
  createPayrollMonthCalendar,
  getPayrollMonthDateRange,
  resolveEffectivePayrollSetting,
} from '../payroll';
import { generateEmployeeMonthlySchedule } from '../schedule';

export type ReadinessSeverity = 'blocking' | 'warning' | 'optional' | 'info';

export type ReadinessIssueCode =
  | 'month-missing'
  | 'calendar-overrides-unresolved'
  | 'employee-missing-employment-start'
  | 'employee-missing-identity'
  | 'employee-missing-department'
  | 'employee-missing-shift'
  | 'department-unresolved-na0'
  | 'department-missing-or-inactive'
  | 'schedule-unresolved-day'
  | 'payroll-setting-missing'
  | 'payroll-setting-conflict'
  | 'entitlement-overlap'
  | 'housing-conflict'
  | 'company-accommodation-missing-variant';

export interface ReadinessIssue {
  code: ReadinessIssueCode;
  severity: ReadinessSeverity;
  employeeId?: string;
  tetaNumber?: string;
  employeeName?: string;
  target: 'employees' | 'settings' | 'settlement' | 'absences';
  context?: string;
}

export interface ReadinessCounter {
  label: string;
  value: number;
  severity: ReadinessSeverity;
}

export interface MonthReadinessSummary {
  monthId: MonthId;
  monthExists: boolean;
  participants: number;
  counters: {
    blocking: number;
    warning: number;
    optional: number;
    info: number;
  };
  issues: ReadinessIssue[];
}

export interface MonthReadinessInput {
  monthId: MonthId;
  month: PayrollMonth | null;
  employees: readonly Employee[];
  departments: readonly Department[];
  employeeAssignments?: readonly EmployeeAssignment[];
  scheduleCorrections?: readonly ScheduleCorrection[];
  entitlements: readonly EmployeeEntitlement[];
  payrollSettings: readonly PayrollSetting[];
}

function employeeName(employee: Employee): string {
  return `${employee.lastName} ${employee.firstName}`.trim();
}

function hasIdentity(employee: Employee): boolean {
  return Boolean(
    employee.pesel?.trim() ||
    employee.passportNumber?.trim() ||
    employee.foreignDocumentNumber?.trim(),
  );
}

function employeeParticipates(employee: Employee, monthId: MonthId): boolean {
  return employeeParticipatesInPayrollMonth(
    {
      employmentStart: employee.employmentStartDate,
      employmentEnd: employee.employmentEndDate,
    },
    getPayrollMonthDateRange(monthId),
  );
}

function increment(
  counters: MonthReadinessSummary['counters'],
  severity: ReadinessSeverity,
) {
  counters[severity] += 1;
}

function addIssue(summary: MonthReadinessSummary, issue: ReadinessIssue): void {
  summary.issues.push(issue);
  increment(summary.counters, issue.severity);
}

function settingIdentity(setting: PayrollSetting): string {
  return `${setting.settingKey}::${setting.variantKey ?? ''}`;
}

function settingsOverlap(
  first: PayrollSetting,
  second: PayrollSetting,
): boolean {
  return (
    first.validFrom <= (second.validTo ?? '9999-12') &&
    (first.validTo ?? '9999-12') >= second.validFrom
  );
}

function activeEntitlementsForEmployee(
  employee: Employee,
  entitlements: readonly EmployeeEntitlement[],
): EmployeeEntitlement[] {
  return entitlements.filter(
    (entitlement) =>
      entitlement.employeeId === employee.id && entitlement.status === 'ACTIVE',
  );
}

export function assessMonthReadiness({
  monthId,
  month,
  employees,
  departments,
  employeeAssignments = [],
  scheduleCorrections = [],
  entitlements,
  payrollSettings,
}: MonthReadinessInput): MonthReadinessSummary {
  const summary: MonthReadinessSummary = {
    monthId,
    monthExists: Boolean(month),
    participants: 0,
    counters: { blocking: 0, warning: 0, optional: 0, info: 0 },
    issues: [],
  };
  const departmentsById = new Map(
    departments.map((department) => [department.id, department]),
  );
  const payrollCalendarDays = createPayrollMonthCalendar(monthId);

  if (!month) {
    addIssue(summary, {
      code: 'month-missing',
      severity: 'blocking',
      target: 'settlement',
      context: monthId,
    });
  }

  addIssue(summary, {
    code: 'calendar-overrides-unresolved',
    severity: 'warning',
    target: 'settlement',
    context: monthId,
  });

  employees.forEach((employee) => {
    const baseIssue = {
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      employeeName: employeeName(employee),
    };

    if (!employee.employmentStartDate) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-employment-start',
        severity: 'blocking',
        target: 'employees',
      });
      return;
    }

    if (!employeeParticipates(employee, monthId)) {
      return;
    }
    summary.participants += 1;

    if (!hasIdentity(employee)) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-identity',
        severity: 'warning',
        target: 'employees',
      });
    }

    if (!employee.departmentId) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-department',
        severity: 'optional',
        target: 'employees',
      });
    } else if (employee.departmentId.toLocaleUpperCase('pl-PL') === 'NA0') {
      addIssue(summary, {
        ...baseIssue,
        code: 'department-unresolved-na0',
        severity: 'warning',
        target: 'employees',
      });
    } else {
      const department = departmentsById.get(employee.departmentId);
      if (!department || !department.active) {
        addIssue(summary, {
          ...baseIssue,
          code: 'department-missing-or-inactive',
          severity: 'warning',
          target: 'employees',
          context: employee.departmentId,
        });
      }
    }

    if (!employee.shiftAssignment) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-shift',
        severity: 'optional',
        target: 'employees',
      });
    }

    const schedule = generateEmployeeMonthlySchedule({
      employee,
      days: payrollCalendarDays,
      departments,
      options: {
        assignments: employeeAssignments,
        corrections: scheduleCorrections,
      },
    });
    const unresolvedDay = schedule.find((day) => day.status === 'UNRESOLVED');
    if (unresolvedDay) {
      addIssue(summary, {
        ...baseIssue,
        code: 'schedule-unresolved-day',
        severity: 'warning',
        target: 'settlement',
        context: unresolvedDay.date,
      });
    }

    const employeeEntitlements = activeEntitlementsForEmployee(
      employee,
      entitlements,
    );
    employeeEntitlements.forEach((first, index) => {
      employeeEntitlements.slice(index + 1).forEach((second) => {
        if (!employeeEntitlementsOverlap(first, second)) {
          return;
        }
        if (
          (first.type === 'COMPANY_ACCOMMODATION' &&
            second.type === 'OWN_HOUSING_ALLOWANCE') ||
          (first.type === 'OWN_HOUSING_ALLOWANCE' &&
            second.type === 'COMPANY_ACCOMMODATION')
        ) {
          addIssue(summary, {
            ...baseIssue,
            code: 'housing-conflict',
            severity: 'warning',
            target: 'employees',
          });
          return;
        }
        if (first.type === second.type) {
          addIssue(summary, {
            ...baseIssue,
            code: 'entitlement-overlap',
            severity: 'warning',
            target: 'employees',
            context: first.type,
          });
        }
      });
    });

    employeeEntitlements
      .filter(
        (entitlement) =>
          entitlement.type === 'COMPANY_ACCOMMODATION' &&
          !entitlement.accommodationVariantKey?.trim(),
      )
      .forEach(() =>
        addIssue(summary, {
          ...baseIssue,
          code: 'company-accommodation-missing-variant',
          severity: 'warning',
          target: 'employees',
        }),
      );
  });

  PAYROLL_SETTING_KEYS.forEach((settingKey) => {
    try {
      if (
        !resolveEffectivePayrollSetting(payrollSettings, settingKey, monthId)
      ) {
        addIssue(summary, {
          code: 'payroll-setting-missing',
          severity: 'warning',
          target: 'settings',
          context: settingKey,
        });
      }
    } catch {
      addIssue(summary, {
        code: 'payroll-setting-conflict',
        severity: 'warning',
        target: 'settings',
        context: settingKey,
      });
    }
  });

  const groupedSettings = new Map<string, PayrollSetting[]>();
  payrollSettings
    .filter((setting) => setting.active)
    .forEach((setting) => {
      const key = settingIdentity(setting);
      groupedSettings.set(key, [...(groupedSettings.get(key) ?? []), setting]);
    });
  groupedSettings.forEach((settings) => {
    settings.forEach((first, index) => {
      settings.slice(index + 1).forEach((second) => {
        if (settingsOverlap(first, second)) {
          addIssue(summary, {
            code: 'payroll-setting-conflict',
            severity: 'warning',
            target: 'settings',
            context: first.settingKey,
          });
        }
      });
    });
  });

  return summary;
}
