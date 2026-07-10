import type {
  Absence,
  Adjustment,
  DailyValue,
  Employee,
  PayrollSetting,
} from '../../types/firestore';
import {
  calculateEmployeeMonthlyDraft,
  calculateMonthlyDrafts,
  STANDARD_WORKING_DAY_HOURS,
} from '.';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    tetaNumber: 'T001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: utcDate('2026-01-01'),
    employmentEndDate: null,
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function dailyValue(overrides: Partial<DailyValue>): DailyValue {
  return {
    id: 'employee-1_2026-06-01',
    monthId: '2026-06',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    date: '2026-06-01',
    hours: 8,
    source: 'manual',
    importId: null,
    note: null,
    manualOverride: null,
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function absence(overrides: Partial<Absence>): Absence {
  return {
    id: 'absence-1',
    monthId: '2026-06',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    absenceCode: 'L4',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    hoursPerDay: null,
    source: 'manual',
    importId: null,
    status: 'ACTIVE',
    note: null,
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function payrollSetting(
  overrides: Partial<PayrollSetting> = {},
): PayrollSetting {
  return {
    id: 'setting-1',
    settingKey: 'frequency_bonus',
    variantKey: null,
    variantName: null,
    amount: 400,
    validFrom: '2026-01',
    validTo: null,
    active: true,
    description: 'Premia frekwencyjna',
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function adjustment(overrides: Partial<Adjustment>): Adjustment {
  return {
    id: 'adjustment-1',
    monthId: '2026-06',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    category: 'MANUAL_BONUS',
    direction: 'INCREASE',
    amount: 100,
    note: 'Test',
    status: 'ACTIVE',
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
  };
}

function draft({
  target = employee(),
  dailyValues = [],
  absences = [],
  settings = [payrollSetting()],
  adjustments = [],
}: {
  target?: Employee;
  dailyValues?: DailyValue[];
  absences?: Absence[];
  settings?: PayrollSetting[];
  adjustments?: Adjustment[];
} = {}) {
  return calculateEmployeeMonthlyDraft({
    monthId: '2026-06',
    employee: target,
    dailyValues,
    absences,
    payrollSettings: settings,
    adjustments,
  });
}

describe('employee monthly calculation draft', () => {
  it('marks an employee outside the month as non-participating', () => {
    const result = draft({
      target: employee({
        employmentStartDate: utcDate('2026-07-01'),
      }),
    });

    expect(result.employment.participatesInMonth).toBe(false);
    expect(result.totals.nominalHours).toBe(0);
    expect(result.warnings.map((item) => item.code)).toContain(
      'employee-not-participating',
    );
  });

  it('calculates a partial participant nominal from working days inside employment', () => {
    const result = draft({
      target: employee({
        employmentStartDate: utcDate('2026-06-15'),
      }),
    });

    expect(result.employment.participatesInMonth).toBe(true);
    expect(result.employment.fullCalendarMonth).toBe(false);
    expect(result.totals.nominalHours).toBe(12 * STANDARD_WORKING_DAY_HOURS);
  });

  it('calculates full-month participation and virtual worked hours', () => {
    const result = draft();

    expect(result.employment.fullCalendarMonth).toBe(true);
    expect(result.totals.nominalHours).toBe(22 * STANDARD_WORKING_DAY_HOURS);
    expect(result.attendance.virtualHours).toBe(
      22 * STANDARD_WORKING_DAY_HOURS,
    );
    expect(result.totals.workedHours).toBe(22 * STANDARD_WORKING_DAY_HOURS);
  });

  it('uses manual override as the effective imported attendance value', () => {
    const result = draft({
      dailyValues: [
        dailyValue({
          source: 'attendance_import',
          hours: 8,
          importId: 'import-1',
          manualOverride: {
            hours: 6,
            note: 'Korekta',
            actorUid: 'coordinator',
            updatedAt: createdAt,
          },
        }),
      ],
    });

    expect(result.attendance.importedOverrideHours).toBe(6);
    expect(result.attendance.importedHours).toBe(0);
    expect(result.attendance.explicitHours).toBe(6);
    expect(result.totals.workedHours).toBe(21 * STANDARD_WORKING_DAY_HOURS + 6);
  });

  it('counts active absences and ignores cancelled absences', () => {
    const result = draft({
      absences: [
        absence({ id: 'active-l4', startDate: '2026-06-01' }),
        absence({
          id: 'cancelled-l4',
          startDate: '2026-06-02',
          endDate: '2026-06-02',
          status: 'CANCELLED',
        }),
      ],
    });

    expect(result.absences.groups).toEqual([
      {
        code: 'L4',
        dayCount: 1,
        nominalHours: STANDARD_WORKING_DAY_HOURS,
      },
    ]);
    expect(result.attendance.virtualHours).toBe(
      21 * STANDARD_WORKING_DAY_HOURS,
    );
  });

  it('uses active L4 records for the frequency bonus reason and amount', () => {
    const result = draft({
      absences: [
        absence({ id: 'l4-1', startDate: '2026-06-01' }),
        absence({
          id: 'l4-2',
          startDate: '2026-06-10',
          endDate: '2026-06-10',
        }),
      ],
    });

    expect(result.bonuses.frequency.l4RecordCount).toBe(2);
    expect(result.bonuses.frequency.reason).toBe('ELIGIBLE');
    expect(result.totals.frequencyBonusAmount).toBe(300);
  });

  it('zeros the frequency bonus when an active NN overlaps the month', () => {
    const result = draft({
      absences: [
        absence({
          id: 'nn-1',
          absenceCode: 'NN',
          startDate: '2026-06-10',
          endDate: '2026-06-10',
        }),
      ],
    });

    expect(result.bonuses.frequency.hasNnAbsence).toBe(true);
    expect(result.bonuses.frequency.reason).toBe('NN_ABSENCE');
    expect(result.totals.frequencyBonusAmount).toBe(0);
  });

  it('does not reduce the frequency bonus for approved absences', () => {
    const result = draft({
      absences: [
        absence({
          id: 'uw-1',
          absenceCode: 'UW',
          startDate: '2026-06-10',
          endDate: '2026-06-10',
        }),
      ],
    });

    expect(result.absences.approvedOrJustifiedHours).toBe(
      STANDARD_WORKING_DAY_HOURS,
    );
    expect(result.totals.frequencyBonusAmount).toBe(400);
  });

  it('includes active adjustments and ignores cancelled adjustments', () => {
    const result = draft({
      adjustments: [
        adjustment({ amount: 150 }),
        adjustment({
          id: 'deduction-1',
          category: 'MANUAL_DEDUCTION',
          direction: 'DECREASE',
          amount: 40,
        }),
        adjustment({
          id: 'cancelled-1',
          amount: 999,
          status: 'CANCELLED',
        }),
      ],
    });

    expect(result.adjustments.increases).toBe(150);
    expect(result.adjustments.decreases).toBe(40);
    expect(result.adjustments.entries).toHaveLength(2);
    expect(result.totals.preliminaryGrossAdditions).toBe(550);
    expect(result.totals.preliminaryGrossDeductions).toBe(40);
  });

  it('reports conflict and non-working warnings without hiding explicit hours', () => {
    const result = draft({
      dailyValues: [
        dailyValue({ date: '2026-06-01', hours: 7 }),
        dailyValue({
          id: 'employee-1_2026-06-06',
          date: '2026-06-06',
          hours: 5,
        }),
      ],
      absences: [absence({ startDate: '2026-06-01' })],
    });

    expect(result.attendance.conflictDays).toEqual(['2026-06-01']);
    expect(result.attendance.explicitHours).toBe(12);
    expect(result.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'attendance-absence-conflict',
        'explicit-non-working-day',
      ]),
    );
  });

  it('warns and excludes explicit values outside employment from worked hours', () => {
    const result = draft({
      target: employee({
        employmentStartDate: utcDate('2026-06-10'),
      }),
      dailyValues: [dailyValue({ date: '2026-06-01', hours: 8 })],
    });

    expect(result.attendance.outsideEmploymentValueDays).toEqual([
      '2026-06-01',
    ]);
    expect(result.attendance.explicitHours).toBe(0);
    expect(result.warnings.map((item) => item.code)).toContain(
      'attendance-outside-employment',
    );
  });

  it('warns and leaves frequency bonus amount unresolved when the setting is missing', () => {
    const result = draft({ settings: [] });

    expect(result.totals.frequencyBonusAmount).toBeNull();
    expect(result.bonuses.frequency.configuredSettingId).toBeNull();
    expect(result.warnings.map((item) => item.code)).toContain(
      'unresolved-frequency-bonus-setting',
    );
  });

  it('calculates drafts for all provided employees', () => {
    const second = employee({
      id: 'employee-2',
      tetaNumber: 'T002',
      employmentStartDate: utcDate('2026-07-01'),
    });

    const results = calculateMonthlyDrafts({
      monthId: '2026-06',
      employees: [employee(), second],
      dailyValues: [],
      absences: [],
      payrollSettings: [payrollSetting()],
      adjustments: [],
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.employment.participatesInMonth).toBe(true);
    expect(results[1]?.employment.participatesInMonth).toBe(false);
  });
});
