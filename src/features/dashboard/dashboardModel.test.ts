import { describe, expect, it } from 'vitest';

import type {
  Absence,
  Department,
  Employee,
  EmployeeEntitlement,
} from '../../types/firestore';
import {
  buildDashboardSnapshot,
  calculateMonthlyRotation,
  calculateRotationOverview,
} from './dashboardModel';

const today = new Date('2026-07-17T12:00:00.000Z');

describe('dashboardModel', () => {
  it('uses current employment, confirmed L4 and selected-month reported L4', () => {
    const employees = [
      employee('active', {
        citizenship: 'PL',
        departmentId: 'metal',
        shiftAssignment: 'RED',
      }),
      employee('ending', {
        citizenship: 'UA',
        departmentId: 'metal',
        employmentEndDate: new Date('2026-07-25T00:00:00.000Z'),
        shiftAssignment: 'WHITE',
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
    expect(snapshot.citizenship).toEqual({
      polish: 1,
      foreign: 1,
      missing: 0,
    });
    expect(snapshot.expiringContracts.map(({ id }) => id)).toEqual(['ending']);
    expect(snapshot.departmentSummaries).toEqual([
      {
        id: 'metal',
        name: 'Metal',
        activeEmployees: 2,
        presentEmployees: 1,
        employeesOnL4Today: 1,
        otherAbsentEmployees: 0,
        shiftGroups: { red: 1, white: 1, blue: 0, unassigned: 0 },
      },
    ]);
  });

  it('builds a seven-day L4 and vacation trend without double-counting governed absences', () => {
    const employees = [
      employee('l4', { citizenship: 'UA' }),
      employee('leave', { citizenship: null }),
      employee('overlap', { citizenship: 'PL' }),
    ];

    const snapshot = buildDashboardSnapshot({
      employees,
      departments: [],
      entitlements: [],
      currentAbsences: [
        absence('l4-import', 'l4', {
          startDate: '2026-07-15',
          endDate: '2026-07-17',
          source: 'absence_import',
          importId: 'report',
        }),
        absence('leave', 'leave', {
          absenceCode: 'UW',
          startDate: '2026-07-16',
          endDate: '2026-07-17',
        }),
        absence('overlap-leave', 'overlap', {
          absenceCode: 'UZ',
          startDate: '2026-07-17',
          endDate: '2026-07-17',
        }),
        absence('overlap-l4', 'overlap', {
          startDate: '2026-07-17',
          endDate: '2026-07-17',
          source: 'absence_import',
          importId: 'report-2',
        }),
      ],
      selectedMonthAbsences: [],
      readiness: null,
      today,
    });

    expect(snapshot.citizenship).toEqual({
      polish: 1,
      foreign: 1,
      missing: 1,
    });
    expect(
      snapshot.absenceTrend.map(({ date, l4, vacation, total }) => ({
        date: date.toISOString().slice(0, 10),
        l4,
        vacation,
        total,
      })),
    ).toEqual([
      { date: '2026-07-11', l4: 0, vacation: 0, total: 0 },
      { date: '2026-07-12', l4: 0, vacation: 0, total: 0 },
      { date: '2026-07-13', l4: 0, vacation: 0, total: 0 },
      { date: '2026-07-14', l4: 0, vacation: 0, total: 0 },
      { date: '2026-07-15', l4: 1, vacation: 0, total: 1 },
      { date: '2026-07-16', l4: 1, vacation: 1, total: 2 },
      { date: '2026-07-17', l4: 2, vacation: 1, total: 3 },
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

  it('calculates current-month rotation from terminations and average headcount', () => {
    const employees = [
      employee('existing'),
      employee('hired', {
        employmentStartDate: new Date('2026-07-10T00:00:00.000Z'),
      }),
      employee('terminated', {
        employmentEndDate: new Date('2026-07-15T00:00:00.000Z'),
      }),
      employee('historical', {
        employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
      }),
    ];

    expect(calculateMonthlyRotation(employees, today)).toEqual({
      monthId: '2026-07',
      hired: 1,
      terminated: 1,
      averageHeadcount: 2,
      rate: 50,
    });
  });

  it('returns zero rotation when the month has no average headcount', () => {
    expect(
      calculateMonthlyRotation(
        [
          employee('historical', {
            employmentStartDate: new Date('2026-06-01T00:00:00.000Z'),
            employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
          }),
        ],
        today,
      ),
    ).toEqual({
      monthId: '2026-07',
      hired: 0,
      terminated: 0,
      averageHeadcount: 0,
      rate: 0,
    });
  });

  it('builds selected-month and previous-month rotation by citizenship', () => {
    const employees = [
      employee('polish-existing', { citizenship: 'PL' }),
      employee('polish-ended', {
        citizenship: 'PL',
        employmentEndDate: new Date('2026-07-15T00:00:00.000Z'),
      }),
      employee('foreign-hired', {
        citizenship: 'UA',
        employmentStartDate: new Date('2026-07-10T00:00:00.000Z'),
      }),
      employee('foreign-ended-before', {
        citizenship: 'UA',
        employmentEndDate: new Date('2026-06-20T00:00:00.000Z'),
      }),
      employee('unknown-ended', {
        citizenship: null,
        employmentEndDate: new Date('2026-07-12T00:00:00.000Z'),
      }),
    ];

    const overview = calculateRotationOverview(employees, '2026-07');

    expect(overview.monthId).toBe('2026-07');
    expect(overview.previousMonthId).toBe('2026-06');
    expect(overview.total).toMatchObject({
      hired: 1,
      terminated: 2,
      averageHeadcount: 2.5,
      rate: 80,
    });
    expect(overview.previousTotal).toMatchObject({
      hired: 0,
      terminated: 1,
    });
    expect(overview.polish).toMatchObject({
      hired: 0,
      terminated: 1,
      averageHeadcount: 1.5,
      rate: 66.7,
    });
    expect(overview.foreign).toMatchObject({
      hired: 1,
      terminated: 0,
      averageHeadcount: 0.5,
      rate: 0,
    });
    expect(overview.unclassified).toMatchObject({
      hired: 0,
      terminated: 1,
      averageHeadcount: 0.5,
      rate: 200,
    });
  });

  it('handles January comparison across the year boundary', () => {
    expect(calculateRotationOverview([], '2026-01').previousMonthId).toBe(
      '2025-12',
    );
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
