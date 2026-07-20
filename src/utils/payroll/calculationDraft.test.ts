import type {
  Absence,
  Adjustment,
  DailyValue,
  Employee,
  EmployeeEntitlement,
  PayrollSetting,
} from '../../types/firestore';
import {
  calculateEmployeeMonthlyDraft,
  calculateMonthlyDrafts,
  resolveMonthlyEmployeeEntitlements,
  STANDARD_WORKING_DAY_HOURS,
  type PayrollCalendarOptions,
  type EmployeeSettlementEntitlements,
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
    pesel: overrides.pesel ?? null,
    passportNumber: overrides.passportNumber ?? null,
    foreignDocumentNumber: overrides.foreignDocumentNumber ?? null,
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
  const absenceCode = overrides.absenceCode ?? 'L4';
  const source =
    overrides.source ?? (absenceCode === 'L4' ? 'absence_import' : 'manual');
  return {
    id: 'absence-1',
    monthId: '2026-06',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    absenceCode,
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    hoursPerDay: null,
    source,
    importId:
      overrides.importId ?? (source === 'absence_import' ? 'import-1' : null),
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
    taxType: 'GROSS',
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

function defaultPayrollSettings(): PayrollSetting[] {
  return [
    payrollSetting(),
    payrollSetting({
      id: 'transport',
      settingKey: 'transport_allowance',
      amount: 275,
      taxType: 'NET',
    }),
    payrollSetting({
      id: 'laundry',
      settingKey: 'laundry_allowance',
      amount: 40,
    }),
    payrollSetting({
      id: 'holiday',
      settingKey: 'holiday_work_bonus',
      amount: 300,
    }),
    payrollSetting({ id: 'udt', settingKey: 'udt_allowance', amount: 300 }),
  ];
}

function entitlement(
  overrides: Partial<EmployeeEntitlement> = {},
): EmployeeEntitlement {
  return {
    id: 'entitlement-1',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    type: 'UDT',
    accommodationVariantKey: null,
    validFrom: '2026-01-01',
    validTo: null,
    status: 'ACTIVE',
    note: null,
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
  settings = defaultPayrollSettings(),
  adjustments = [],
  entitlements = null,
  calendarOptions = {},
}: {
  target?: Employee;
  dailyValues?: DailyValue[];
  absences?: Absence[];
  settings?: PayrollSetting[];
  adjustments?: Adjustment[];
  entitlements?: EmployeeSettlementEntitlements | null;
  calendarOptions?: PayrollCalendarOptions;
} = {}) {
  return calculateEmployeeMonthlyDraft({
    monthId: '2026-06',
    employee: target,
    dailyValues,
    absences,
    payrollSettings: settings,
    adjustments,
    entitlements,
    calendarOptions,
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

  it('keeps a Friday-Monday L4 as one reporting period but counts only working days and hours', () => {
    const result = draft({
      absences: [
        absence({
          id: 'l4-weekend-period',
          startDate: '2026-06-05',
          endDate: '2026-06-08',
        }),
      ],
    });

    expect(result.absences.periods).toEqual([
      {
        id: 'l4-weekend-period',
        code: 'L4',
        startDate: '2026-06-05',
        endDate: '2026-06-08',
        workingDayCount: 2,
        workingHours: 16,
      },
    ]);
    expect(result.absences.l4Hours).toBe(16);
  });

  it('warns about manual L4 without treating it as confirmed payroll sickness', () => {
    const result = draft({
      absences: [
        absence({
          id: 'manual-l4',
          source: 'manual',
          importId: null,
          startDate: '2026-06-01',
          endDate: '2026-06-01',
        }),
      ],
    });

    expect(result.absences.groups).toEqual([]);
    expect(result.absences.l4Hours).toBe(0);
    expect(result.attendance.virtualHours).toBe(
      21 * STANDARD_WORKING_DAY_HOURS,
    );
    expect(result.warnings.map((item) => item.code)).toContain(
      'unconfirmed-l4',
    );
  });

  it('uses confirmed L4 missed workdays for the frequency bonus amount', () => {
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
    expect(result.bonuses.frequency.l4MissedWorkingDayCount).toBe(2);
    expect(result.bonuses.frequency.reason).toBe('ELIGIBLE');
    expect(result.totals.frequencyBonusAmount).toBe(300);
  });

  it('does not automatically reduce the frequency bonus for NN', () => {
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

    expect(result.bonuses.frequency.hasNnAbsence).toBe(false);
    expect(result.bonuses.frequency.reason).toBe('ELIGIBLE');
    expect(result.totals.frequencyBonusAmount).toBe(400);
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

  it('calculates transport netto and laundry brutto proportionally by physically worked days', () => {
    const result = draft({
      absences: [
        absence({
          id: 'l4-1',
          absenceCode: 'L4',
          startDate: '2026-06-01',
          endDate: '2026-06-01',
        }),
        absence({
          id: 'uw-1',
          absenceCode: 'UW',
          startDate: '2026-06-02',
          endDate: '2026-06-02',
        }),
      ],
    });

    expect(result.workDays.eligibleWorkingDays).toBe(22);
    expect(result.workDays.physicallyWorkedDays).toBe(20);
    expect(result.components.transportAllowanceNetto).toBe(250);
    expect(result.components.laundryAllowanceBrutto).toBe(36.36);
    expect(result.absences.vacationHours).toBe(8);
  });

  it('combines all 100% overtime sources and pays the holiday bonus only once per month', () => {
    const result = draft({
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-06-04',
          date: '2026-06-04',
          hours: 4,
        }),
        dailyValue({
          id: 'employee-1_2026-06-06',
          date: '2026-06-06',
          hours: 4,
        }),
      ],
      calendarOptions: {
        publicHolidays: new Set(['2026-06-04']),
      },
    });

    expect(result.workTime.overtime100Hours).toBe(8);
    expect(result.workTime.paidOvertime100Hours).toBe(8);
    expect(result.components.holidayWorkBonusBrutto).toBe(300);
  });

  it('uses explicitly linked Sunday 100% hours for WZN before ordinary balancing', () => {
    const result = draft({
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-06-07',
          date: '2026-06-07',
          hours: 8,
          workTimeCorrection: {
            plannedShift: 'FIRST',
            plannedStartTime: '06:00',
            plannedEndTime: '14:00',
            actualStartTime: '06:00',
            actualEndTime: '14:00',
            classificationOverride: null,
          },
        }),
      ],
      absences: [
        absence({
          id: 'wzn-friday',
          absenceCode: 'WZN',
          startDate: '2026-06-05',
          endDate: '2026-06-05',
          linkedWorkDate: '2026-06-07',
        }),
      ],
    });

    expect(result.workTime.overtime100Hours).toBe(8);
    expect(result.workTime.wznCompensatedHours).toBe(8);
    expect(result.workTime.wznUnresolvedHours).toBe(0);
    expect(result.workTime.paidOvertime100Hours).toBe(0);
  });

  it('blocks completion when WZN has no linked 100% work', () => {
    const result = draft({
      absences: [
        absence({
          id: 'wzn-unlinked',
          absenceCode: 'WZN',
          startDate: '2026-06-05',
          endDate: '2026-06-05',
          linkedWorkDate: null,
        }),
      ],
    });

    expect(result.workTime.wznUnresolvedHours).toBe(8);
    expect(result.warnings.map((item) => item.code)).toContain(
      'unresolved-wzn-link',
    );
  });

  it('keeps work-time quantities separate from monetary salary calculation', () => {
    const result = draft();

    expect(result.workTime.paidOvertime50Hours).toBe(0);
    expect(result.workTime.paidOvertime100Hours).toBe(0);
    expect(result.totals.bruttoAdditions).toBe(440);
    expect(result.totals.nettoAllowances).toBe(275);
    expect(result.totals).not.toHaveProperty('netSalary');
  });

  it('pays UDT only for full-month eligible employment and does not reduce it by absences', () => {
    expect(
      draft({ entitlements: { udtEligible: true } }).components,
    ).toMatchObject({ udtAllowanceBrutto: 300 });

    expect(
      draft({
        target: employee({ employmentStartDate: utcDate('2026-06-02') }),
        entitlements: { udtEligible: true },
      }).components.udtAllowanceBrutto,
    ).toBe(0);

    expect(
      draft({
        absences: [absence({ startDate: '2026-06-01' })],
        entitlements: { udtEligible: true },
      }).components.udtAllowanceBrutto,
    ).toBe(300);
  });

  it('calculates company accommodation deduction by contract-validity days, not worked days', () => {
    const result = draft({
      absences: [absence({ startDate: '2026-06-16', endDate: '2026-06-16' })],
      entitlements: {
        companyAccommodation: {
          variantKey: 'type-a',
          contractStartDate: utcDate('2026-06-16'),
          contractEndDate: utcDate('2026-06-30'),
        },
      },
      settings: [
        payrollSetting(),
        payrollSetting({
          id: 'type-a',
          settingKey: 'accommodation_allowance',
          variantKey: 'type-a',
          variantName: 'Typ A',
          amount: 150,
        }),
      ],
    });

    expect(result.components.companyAccommodationMediaDeduction).toBe(250);
    expect(result.components.companyAccommodationRentDeduction).toBe(75);
    expect(result.components.companyAccommodationDeduction).toBe(325);
  });

  it('leaves company accommodation unresolved when the variant setting is missing', () => {
    const result = draft({
      entitlements: {
        companyAccommodation: {
          variantKey: 'type-a',
          contractStartDate: utcDate('2026-06-01'),
          contractEndDate: utcDate('2026-06-30'),
        },
      },
    });

    expect(result.components.companyAccommodationDeduction).toBe(0);
    expect(result.warnings.map((item) => item.code)).toContain(
      'unresolved-company-accommodation-variant',
    );
  });

  it('pays own housing allowance only for full-month eligible employment', () => {
    const settings = [
      payrollSetting(),
      payrollSetting({
        id: 'own-housing',
        settingKey: 'own_housing_allowance',
        amount: 200,
      }),
    ];

    expect(
      draft({
        settings,
        entitlements: { ownHousingAllowanceEligible: true },
      }).components.ownHousingAllowanceBrutto,
    ).toBe(200);
    expect(
      draft({
        target: employee({ employmentStartDate: utcDate('2026-06-02') }),
        settings,
        entitlements: { ownHousingAllowanceEligible: true },
      }).components.ownHousingAllowanceBrutto,
    ).toBe(0);
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
    expect(result.totals.preliminaryGrossAdditions).toBe(590);
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
      payrollSettings: defaultPayrollSettings(),
      adjustments: [],
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.employment.participatesInMonth).toBe(true);
    expect(results[1]?.employment.participatesInMonth).toBe(false);
  });

  it('aggregates settlement components from effective-dated employee entitlements', () => {
    const employees = [employee()];
    const entitlementsByEmployeeId = resolveMonthlyEmployeeEntitlements({
      monthId: '2026-06',
      employees,
      entitlements: [
        entitlement({ type: 'UDT' }),
        entitlement({
          id: 'own-housing',
          type: 'OWN_HOUSING_ALLOWANCE',
          validFrom: '2026-06-01',
          validTo: '2026-06-30',
        }),
      ],
    });

    const [result] = calculateMonthlyDrafts({
      monthId: '2026-06',
      employees,
      dailyValues: [],
      absences: [],
      payrollSettings: [
        ...defaultPayrollSettings(),
        payrollSetting({
          id: 'own-housing-setting',
          settingKey: 'own_housing_allowance',
          amount: 200,
        }),
      ],
      adjustments: [],
      entitlementsByEmployeeId,
    });

    expect(result?.components.udtAllowanceBrutto).toBe(300);
    expect(result?.components.ownHousingAllowanceBrutto).toBe(200);
  });
});
