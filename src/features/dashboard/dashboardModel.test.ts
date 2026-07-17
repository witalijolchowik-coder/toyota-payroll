import { describe, expect, it } from 'vitest';

import type {
  Absence,
  Department,
  Employee,
  EmployeeEntitlement,
} from '../../types/firestore';
import { buildDashboardSnapshot } from './dashboardModel';

const today = new Date('2026-07-17T12:00:00.000Z');

describe('dashboardModel', () => {
  it('uses current employment, confirmed L4 and selected-month reported L4', () => {
    const employees = [
      employee('active', { departmentId: 'metal' }),
      employee('ending', {
        departmentId: 'metal',
        employmentEndDate: new Date('2026-07-25T00:00:00.000Z'),
      }),
      employee('historical', {
        employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
      }),
    ];

    const snapshot = buildDashboardSnapshot({
      employees,
      departments: [department('metal', 'Metal')],
      entitlements: [],
      currentAbsences: [
        absence('confirmed', 'active', {
          source: 'absence_import',
          importId: 'import-1',
        }),
      ],
      selectedMonthAbsences: [
        absence('reported', 'ending', {
          source: 'manual',
          importId: null,
        }),
      ],
      readiness: null,
      today,
    });

    expect(snapshot.activeEmployees.map(({ id }) => id)).toEqual([
      'active',
      'ending',
    ]);
    expect(snapshot.confirmedL4Today).toBe(1);
    expect(snapshot.unconfirmedL4).toBe(1);
    expect(snapshot.expiringContracts.map(({ id }) => id)).toEqual(['ending']);
    expect(snapshot.departmentSummaries).toEqual([
      {
        id: 'metal',
        name: 'Metal',
        activeEmployees: 2,
        employeesOnL4Today: 1,
      },
    ]);
  });

  it('aggregates medical, missing-data and active accommodation metrics', () => {
    const employees = [
      employee('expired', {
        departmentId: 'metal',
        medicalExaminationDate: new Date('2026-01-01T00:00:00.000Z'),
        medicalValidUntil: new Date('2026-07-16T00:00:00.000Z'),
        medicalExaminationType: 'PRODUKCJA',
      }),
      employee('expiring', {
        departmentId: 'metal',
        medicalExaminationDate: new Date('2026-01-01T00:00:00.000Z'),
        medicalValidUntil: new Date('2026-07-22T00:00:00.000Z'),
        medicalExaminationType: 'PRODUKCJA',
      }),
    ];

    const snapshot = buildDashboardSnapshot({
      employees,
      departments: [department('metal', 'Metal')],
      entitlements: [
        entitlement('company', 'expired', 'COMPANY_ACCOMMODATION'),
        entitlement('own', 'expiring', 'OWN_HOUSING_ALLOWANCE'),
        {
          ...entitlement('old', 'expired', 'COMPANY_ACCOMMODATION'),
          validTo: '2026-07-16',
        },
      ],
      currentAbsences: [],
      selectedMonthAbsences: [],
      readiness: {
        monthId: '2026-06',
        monthExists: true,
        participants: 2,
        counters: { blocking: 2, warning: 0, optional: 0, info: 0 },
        issues: [
          {
            code: 'employee-missing-citizenship',
            severity: 'blocking',
            target: 'employees',
            employeeId: 'expired',
          },
          {
            code: 'employee-missing-pesel',
            severity: 'blocking',
            target: 'employees',
            employeeId: 'expired',
          },
        ],
        levels: {
          dataPreparationPossible: true,
          draftCalculationPossible: false,
          finalizationAllowed: false,
        },
      },
      today,
    });

    expect(snapshot.expiredMedical.map(({ id }) => id)).toEqual(['expired']);
    expect(snapshot.medicalRenewals.map(({ id }) => id)).toEqual([
      'expired',
      'expiring',
    ]);
    expect(snapshot.missingEmployeeData).toBe(1);
    expect(snapshot.accommodation).toEqual({ company: 1, ownHousing: 1 });
    expect(snapshot.deadlines).toEqual([
      expect.objectContaining({ kind: 'medical', employee: employees[1] }),
    ]);
  });
});

function employee(id: string, changes: Partial<Employee> = {}): Employee {
  return {
    id,
    tetaNumber: `WT-${id}`,
    firstName: id,
    lastName: 'Pracownik',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
    employmentEndDate: null,
    createdAt: today,
    createdBy: 'test',
    updatedAt: today,
    updatedBy: 'test',
    ...changes,
  };
}

function department(id: string, name: string): Department {
  return {
    id,
    name,
    shiftMode: 'THREE_SHIFT',
    active: true,
    createdAt: today,
    createdBy: 'test',
    updatedAt: today,
    updatedBy: 'test',
  };
}

function absence(
  id: string,
  employeeId: string,
  changes: Partial<Absence>,
): Absence {
  return {
    id,
    monthId: '2026-07',
    employeeId,
    tetaNumber: `WT-${employeeId}`,
    absenceCode: 'L4',
    startDate: '2026-07-10',
    endDate: '2026-07-20',
    hoursPerDay: null,
    source: 'manual',
    importId: null,
    status: 'ACTIVE',
    note: null,
    createdAt: today,
    createdBy: 'test',
    updatedAt: today,
    updatedBy: 'test',
    ...changes,
  };
}

function entitlement(
  id: string,
  employeeId: string,
  type: EmployeeEntitlement['type'],
): EmployeeEntitlement {
  return {
    id,
    employeeId,
    tetaNumber: `WT-${employeeId}`,
    type,
    accommodationVariantKey: type === 'COMPANY_ACCOMMODATION' ? 'A' : null,
    validFrom: '2026-01-01',
    validTo: null,
    status: 'ACTIVE',
    note: null,
    createdAt: today,
    createdBy: 'test',
    updatedAt: today,
    updatedBy: 'test',
  };
}
