import type {
  Department,
  Employee,
  EmployeeAssignment,
  EmployeeEntitlement,
  MonthId,
  PayrollMonth,
  PayrollSetting,
  ScheduleCorrection,
  Absence,
  DepartmentShiftCorrection,
  ShiftHoursVersion,
  DailyValue,
} from '../../types/firestore';
import { PAYROLL_SETTING_KEYS } from '../../types/firestore';
import {
  employeeEntitlementsOverlap,
  createPayrollMonthCalendar,
  getPayrollMonthDateRange,
  dateToIsoDate,
  resolveEffectivePayrollSetting,
  hasCurrentStatusConflict,
  requiredEmployeeDocumentIssues,
  resolveDailyWorkTimeDeviation,
} from '../payroll';
import {
  activeContracts,
  calculateEmploymentLimit,
  contractBreakDays,
  employeeContractsOverlapRange,
  requiresContractDecision,
} from '../employees';
import { generateEmployeeMonthlySchedule } from '../schedule';

export type ReadinessSeverity = 'blocking' | 'warning' | 'optional' | 'info';

export type ReadinessIssueCode =
  | 'month-missing'
  | 'calendar-overrides-unresolved'
  | 'employee-missing-employment-start'
  | 'employee-missing-identity'
  | 'employee-missing-teta'
  | 'employee-missing-citizenship'
  | 'employee-missing-pesel'
  | 'employee-missing-passport'
  | 'employee-missing-first-toyota-employment-date'
  | 'employee-current-status-conflict'
  | 'employee-contract-invalid'
  | 'employee-contract-overlap'
  | 'employee-contract-decision-required'
  | 'employee-contract-gap'
  | 'employee-employment-limit-approaching'
  | 'unconfirmed-reported-l4'
  | 'employee-missing-department'
  | 'employee-missing-shift'
  | 'department-unresolved-na0'
  | 'department-missing-or-inactive'
  | 'schedule-unresolved-day'
  | 'shift-plan-manual-actual-review'
  | 'shift-plan-overtime-review'
  | 'shift-plan-private-time-review'
  | 'shift-plan-work-conflict'
  | 'payroll-setting-missing'
  | 'payroll-setting-conflict'
  | 'entitlement-overlap'
  | 'housing-conflict'
  | 'company-accommodation-missing-variant'
  | 'company-accommodation-setting-missing'
  | 'own-housing-setting-missing';

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
  levels: {
    dataPreparationPossible: boolean;
    draftCalculationPossible: boolean;
    finalizationAllowed: boolean;
  };
}

export interface MonthReadinessInput {
  monthId: MonthId;
  month: PayrollMonth | null;
  employees: readonly Employee[];
  departments: readonly Department[];
  employeeAssignments?: readonly EmployeeAssignment[];
  scheduleCorrections?: readonly ScheduleCorrection[];
  departmentShiftCorrections?: readonly DepartmentShiftCorrection[];
  shiftHoursVersions?: readonly ShiftHoursVersion[];
  entitlements: readonly EmployeeEntitlement[];
  payrollSettings: readonly PayrollSetting[];
  absences?: readonly Absence[];
  dailyValues?: readonly DailyValue[];
  today?: Date;
}

function employeeName(employee: Employee): string {
  return `${employee.lastName} ${employee.firstName}`.trim();
}

function employeeParticipates(employee: Employee, monthId: MonthId): boolean {
  const range = getPayrollMonthDateRange(monthId);
  return employeeContractsOverlapRange(
    employee,
    dateToIsoDate(range.start),
    dateToIsoDate(range.end),
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
  departmentShiftCorrections = [],
  shiftHoursVersions = [],
  entitlements,
  payrollSettings,
  absences = [],
  dailyValues = [],
  today = new Date(),
}: MonthReadinessInput): MonthReadinessSummary {
  const summary: MonthReadinessSummary = {
    monthId,
    monthExists: Boolean(month),
    participants: 0,
    counters: { blocking: 0, warning: 0, optional: 0, info: 0 },
    issues: [],
    levels: {
      dataPreparationPossible: true,
      draftCalculationPossible: false,
      finalizationAllowed: false,
    },
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

    const contracts = activeContracts(employee);
    if (contracts.length === 0) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-employment-start',
        severity: 'blocking',
        target: 'employees',
      });
      return;
    }

    const invalidContract = contracts.find(
      (contract) =>
        Boolean(contract.endDate) && contract.endDate! < contract.startDate,
    );
    if (invalidContract) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-contract-invalid',
        severity: 'blocking',
        target: 'employees',
        context: invalidContract.id,
      });
    }
    contracts.slice(1).forEach((contract, index) => {
      const previous = contracts[index]!;
      if (!previous.endDate || contract.startDate <= previous.endDate) {
        addIssue(summary, {
          ...baseIssue,
          code: 'employee-contract-overlap',
          severity: 'blocking',
          target: 'employees',
          context: `${previous.id}:${contract.id}`,
        });
      } else {
        const breakDays = contractBreakDays(previous, contract);
        if (breakDays > 0) {
          addIssue(summary, {
            ...baseIssue,
            code: 'employee-contract-gap',
            severity: 'warning',
            target: 'employees',
            context: String(breakDays),
          });
        }
      }
    });
    if (requiresContractDecision(employee, today)) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-contract-decision-required',
        severity: 'warning',
        target: 'employees',
      });
    }

    if (!employeeParticipates(employee, monthId)) {
      return;
    }
    summary.participants += 1;

    const employmentLimit = calculateEmploymentLimit(employee, today);
    if (
      employmentLimit.remainingDays > 0 &&
      employmentLimit.remainingDays <= 31
    ) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-employment-limit-approaching',
        severity: 'warning',
        target: 'employees',
        context: String(employmentLimit.remainingDays),
      });
    }

    if (!employee.tetaNumber.trim()) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-teta',
        severity: 'blocking',
        target: 'employees',
      });
    }

    if (!employee.firstToyotaEmploymentDate) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-first-toyota-employment-date',
        severity: 'blocking',
        target: 'employees',
      });
    }

    requiredEmployeeDocumentIssues(employee).forEach((code) => {
      addIssue(summary, {
        ...baseIssue,
        code: `employee-${code}` as ReadinessIssueCode,
        severity: 'blocking',
        target: 'employees',
      });
    });

    if (hasCurrentStatusConflict(employee, today)) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-current-status-conflict',
        severity: 'warning',
        target: 'employees',
      });
    }

    if (!employee.departmentId) {
      addIssue(summary, {
        ...baseIssue,
        code: 'employee-missing-department',
        severity: 'blocking',
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
          severity: 'blocking',
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
        departmentShiftCorrections,
        shiftHoursVersions,
      },
    });
    const unresolvedDay = schedule.find((day) => day.status === 'UNRESOLVED');
    if (unresolvedDay) {
      addIssue(summary, {
        ...baseIssue,
        code: 'schedule-unresolved-day',
        severity: 'blocking',
        target: 'settlement',
        context: unresolvedDay.date,
      });
    }

    const scheduleByDate = new Map(schedule.map((day) => [day.date, day]));
    dailyValues
      .filter(
        (value) =>
          value.employeeId === employee.id && Boolean(value.workTimeCorrection),
      )
      .forEach((value) => {
        const currentPlan = scheduleByDate.get(value.date);
        const storedPlan = value.workTimeCorrection!;
        if (!currentPlan || !storedPlanDiffers(currentPlan, storedPlan)) return;

        addIssue(summary, {
          ...baseIssue,
          code: 'shift-plan-manual-actual-review',
          severity: 'warning',
          target: 'settlement',
          context: value.date,
        });
        const deviation = resolveDailyWorkTimeDeviation({
          planned: {
            shift: storedPlan.plannedShift,
            startTime: storedPlan.plannedStartTime,
            endTime: storedPlan.plannedEndTime,
          },
          actual: {
            startTime: storedPlan.actualStartTime,
            endTime: storedPlan.actualEndTime,
          },
          isWorkingDay: true,
          classificationOverride: storedPlan.classificationOverride,
        });
        if (deviation.overtime50Hours > 0 || deviation.overtime100Hours > 0) {
          addIssue(summary, {
            ...baseIssue,
            code: 'shift-plan-overtime-review',
            severity: 'warning',
            target: 'settlement',
            context: value.date,
          });
        }
        if (deviation.privateTimeHours > 0) {
          addIssue(summary, {
            ...baseIssue,
            code: 'shift-plan-private-time-review',
            severity: 'warning',
            target: 'settlement',
            context: value.date,
          });
        }
        if (
          currentPlan.status === 'DAY_OFF' ||
          currentPlan.status === 'PUBLIC_HOLIDAY'
        ) {
          addIssue(summary, {
            ...baseIssue,
            code: 'shift-plan-work-conflict',
            severity: 'warning',
            target: 'settlement',
            context: value.date,
          });
        }
      });

    const monthRange = getPayrollMonthDateRange(monthId);
    const monthStart = monthRange.start.toISOString().slice(0, 10);
    const monthEnd = monthRange.end.toISOString().slice(0, 10);
    absences
      .filter(
        (absence) =>
          absence.employeeId === employee.id &&
          absence.status === 'ACTIVE' &&
          absence.absenceCode === 'L4' &&
          absence.source === 'manual' &&
          absence.startDate <= monthEnd &&
          absence.endDate >= monthStart,
      )
      .forEach((absence) =>
        addIssue(summary, {
          ...baseIssue,
          code: 'unconfirmed-reported-l4',
          severity: 'blocking',
          target: 'absences',
          context: `${absence.startDate}–${absence.endDate}`,
        }),
      );

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

    const overlapsMonth = (entitlement: EmployeeEntitlement) =>
      entitlement.validFrom <= monthEnd &&
      (entitlement.validTo ?? '9999-12-31') >= monthStart;

    employeeEntitlements.filter(overlapsMonth).forEach((entitlement) => {
      if (entitlement.type === 'OWN_HOUSING_ALLOWANCE') {
        if (
          !resolveEffectivePayrollSetting(
            payrollSettings,
            'own_housing_allowance',
            monthId,
          )
        ) {
          addIssue(summary, {
            ...baseIssue,
            code: 'own-housing-setting-missing',
            severity: 'blocking',
            target: 'settings',
          });
        }
        return;
      }
      if (entitlement.type !== 'COMPANY_ACCOMMODATION') {
        return;
      }
      const variant = entitlement.accommodationVariantKey?.trim();
      if (!variant) {
        return;
      }
      const hasRent = resolveEffectivePayrollSetting(
        payrollSettings,
        'accommodation_allowance',
        monthId,
        variant,
      );
      const hasMedia =
        resolveEffectivePayrollSetting(
          payrollSettings,
          'company_housing_media',
          monthId,
          variant,
        ) ??
        resolveEffectivePayrollSetting(
          payrollSettings,
          'company_housing_media',
          monthId,
        );
      if (!hasRent || !hasMedia) {
        addIssue(summary, {
          ...baseIssue,
          code: 'company-accommodation-setting-missing',
          severity: 'blocking',
          target: 'settings',
          context: variant,
        });
      }
    });
  });

  PAYROLL_SETTING_KEYS.filter(
    (settingKey) =>
      settingKey !== 'accommodation_allowance' &&
      settingKey !== 'own_housing_allowance' &&
      settingKey !== 'company_housing_media',
  ).forEach((settingKey) => {
    try {
      if (
        !resolveEffectivePayrollSetting(payrollSettings, settingKey, monthId)
      ) {
        addIssue(summary, {
          code: 'payroll-setting-missing',
          severity:
            settingKey === 'laundry_allowance' ||
            settingKey === 'transport_allowance'
              ? 'blocking'
              : 'warning',
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

  summary.levels = {
    dataPreparationPossible: true,
    draftCalculationPossible: Boolean(month) && summary.participants > 0,
    finalizationAllowed:
      Boolean(month) &&
      summary.participants > 0 &&
      summary.counters.blocking === 0,
  };
  return summary;
}

function storedPlanDiffers(
  current: ReturnType<typeof generateEmployeeMonthlySchedule>[number],
  stored: NonNullable<DailyValue['workTimeCorrection']>,
): boolean {
  return (
    current.shift !== stored.plannedShift ||
    current.plannedStartTime !== stored.plannedStartTime ||
    current.plannedEndTime !== stored.plannedEndTime
  );
}
