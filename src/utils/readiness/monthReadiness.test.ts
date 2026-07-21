import { describe, expect, it } from 'vitest';

import type {
  Department,
  Employee,
  EmployeeEntitlement,
  PayrollSetting,
  DailyValue,
} from '../../types/firestore';
import { assessMonthReadiness } from './monthReadiness';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  updatedBy: 'test',
};

function employee(overrides: Partial<Employee> = {}): Employee {
  const start = Object.hasOwn(overrides, 'employmentStartDate')
    ? (overrides.employmentStartDate ?? null)
    : new Date('2026-01-01T00:00:00Z');
  const end = Object.hasOwn(overrides, 'employmentEndDate')
    ? (overrides.employmentEndDate ?? null)
    : null;
  return {
    ...metadata,
    id: 'employee-1',
    tetaNumber: '100',
    firstName: 'Jan',
    lastName: 'Kowalski',
    pesel: '90010112345',
    passportNumber: null,
    foreignDocumentNumber: null,
    citizenship: 'PL',
    firstToyotaEmploymentDate: new Date('2025-09-01T00:00:00Z'),
    isActive: true,
    departmentId: 'paint',
    shiftAssignment: 'RED',
    employmentStartDate: start,
    employmentEndDate: end,
    ...overrides,
    contracts:
      overrides.contracts ??
      (start
        ? [
            {
              id: 'contract-1',
              employeeId: overrides.id ?? 'employee-1',
              tetaNumber: overrides.tetaNumber ?? '100',
              sequenceId: 'sequence-1',
              startDate: start.toISOString().slice(0, 10),
              endDate: end?.toISOString().slice(0, 10) ?? null,
              status: 'ACTIVE',
              note: null,
              ...metadata,
            },
          ]
        : []),
  };
}

function department(overrides: Partial<Department> = {}): Department {
  return {
    ...metadata,
    id: 'paint',
    name: 'Paint',
    shiftMode: 'THREE_SHIFT',
    active: true,
    ...overrides,
  };
}

function setting(
  settingKey: string,
  overrides: Partial<PayrollSetting> = {},
): PayrollSetting {
  return {
    ...metadata,
    id: settingKey,
    settingKey,
    variantKey: null,
    variantName: null,
    amount: 100,
    taxType: 'GROSS',
    validFrom: '2026-01',
    validTo: null,
    active: true,
    description: settingKey,
    ...overrides,
  };
}

function entitlement(
  overrides: Partial<EmployeeEntitlement> = {},
): EmployeeEntitlement {
  return {
    ...metadata,
    id: 'entitlement-1',
    employeeId: 'employee-1',
    tetaNumber: '100',
    type: 'UDT',
    accommodationVariantKey: null,
    validFrom: '2026-07-01',
    validTo: null,
    status: 'ACTIVE',
    note: null,
    ...overrides,
  };
}

const allSettings = [
  'frequency_bonus',
  'transport_allowance',
  'accommodation_allowance',
  'udt_allowance',
  'holiday_work_bonus',
  'laundry_allowance',
  'own_housing_allowance',
  'company_housing_media',
].map((key) =>
  setting(key, {
    variantKey: key === 'accommodation_allowance' ? 'a1' : null,
  }),
);

describe('month readiness assessment', () => {
  it('treats missing employment start as blocking and excludes from participants', () => {
    const readiness = assessMonthReadiness({
      monthId: '2026-07',
      month: null,
      employees: [employee({ employmentStartDate: null })],
      departments: [department()],
      entitlements: [],
      payrollSettings: allSettings,
    });

    expect(readiness.participants).toBe(0);
    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'employee-missing-employment-start',
          severity: 'blocking',
        }),
        expect.objectContaining({ code: 'month-missing' }),
      ]),
    );
  });

  it('flags identity, NA0 department and missing shift without hiding employee', () => {
    const readiness = assessMonthReadiness({
      monthId: '2026-07',
      month: {} as never,
      employees: [
        employee({
          pesel: null,
          departmentId: 'NA0',
          shiftAssignment: null,
        }),
      ],
      departments: [department()],
      entitlements: [],
      payrollSettings: allSettings,
    });

    expect(readiness.participants).toBe(1);
    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'employee-missing-pesel',
        'department-unresolved-na0',
        'employee-missing-shift',
      ]),
    );
  });

  it('detects housing conflicts and missing accommodation variants', () => {
    const readiness = assessMonthReadiness({
      monthId: '2026-07',
      month: {} as never,
      employees: [employee()],
      departments: [department()],
      entitlements: [
        entitlement({ type: 'COMPANY_ACCOMMODATION' }),
        entitlement({ id: 'entitlement-2', type: 'OWN_HOUSING_ALLOWANCE' }),
      ],
      payrollSettings: allSettings,
    });

    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'housing-conflict',
        'company-accommodation-missing-variant',
      ]),
    );
  });

  it('surfaces missing payroll settings for the selected month', () => {
    const readiness = assessMonthReadiness({
      monthId: '2026-07',
      month: {} as never,
      employees: [employee()],
      departments: [department()],
      entitlements: [],
      payrollSettings: allSettings.filter(
        (payrollSetting) => payrollSetting.settingKey !== 'transport_allowance',
      ),
    });

    expect(readiness.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'payroll-setting-missing',
          context: 'transport_allowance',
        }),
      ]),
    );
  });

  it('marks stored actual-time interpretation for review after the plan changes', () => {
    const dailyValue: DailyValue = {
      ...metadata,
      id: 'daily',
      monthId: '2026-07',
      employeeId: 'employee-1',
      tetaNumber: '100',
      date: '2026-07-08',
      hours: 11,
      source: 'manual',
      importId: null,
      note: null,
      manualOverride: null,
      workTimeCorrection: {
        plannedShift: 'FIRST',
        plannedStartTime: '06:00',
        plannedEndTime: '14:00',
        actualStartTime: '05:00',
        actualEndTime: '16:00',
        classificationOverride: null,
      },
    };
    const readiness = assessMonthReadiness({
      monthId: '2026-07',
      month: {} as never,
      employees: [employee()],
      departments: [
        department({
          rotationAnchorWeekStart: '2026-07-06',
          rotationBaseAssignment: {
            RED: 'SECOND',
            WHITE: 'FIRST',
            BLUE: 'NIGHT',
          },
        }),
      ],
      entitlements: [],
      payrollSettings: allSettings,
      dailyValues: [dailyValue],
    });

    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'shift-plan-manual-actual-review',
        'shift-plan-overtime-review',
      ]),
    );
  });
});
