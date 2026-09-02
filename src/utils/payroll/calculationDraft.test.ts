import type {
  Absence,
  Adjustment,
  DailyValue,
  Employee,
  EmployeeEntitlement,
  HolidayWorkBonusDecision,
  MonthId,
  PayrollSetting,
} from '../../types/firestore';
import {
  calculateEmployeeMonthlyDraft,
  calculateMonthlyDrafts,
  createPayrollMonthCalendar,
  resolveMonthlyEmployeeEntitlements,
  STANDARD_WORKING_DAY_HOURS,
  type PayrollCalendarOptions,
  type EmployeeSettlementEntitlements,
  type HousingDepositWithholdingEvidence,
} from '.';
import type { PlannedScheduleDay } from '../schedule';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function employee(overrides: Partial<Employee> = {}): Employee {
  const employmentStartDate =
    overrides.employmentStartDate ?? utcDate('2026-01-01');
  const employmentEndDate = overrides.employmentEndDate ?? null;
  const contracts = overrides.contracts ?? [
    {
      id: 'contract-1',
      employeeId: 'employee-1',
      tetaNumber: 'T001',
      sequenceId: 'sequence-1',
      startDate: employmentStartDate.toISOString().slice(0, 10),
      endDate: employmentEndDate?.toISOString().slice(0, 10) ?? null,
      status: 'ACTIVE' as const,
      note: null,
      createdAt,
      createdBy: 'test',
      updatedAt: createdAt,
      updatedBy: 'test',
    },
  ];
  return {
    id: 'employee-1',
    tetaNumber: 'T001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate,
    employmentEndDate,
    employmentEndEvents: [],
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
    ...overrides,
    contracts,
    pesel: overrides.pesel ?? null,
    passportNumber: overrides.passportNumber ?? null,
    foreignDocumentNumber: overrides.foreignDocumentNumber ?? null,
  };
}

function explicitEmploymentEnd(endDate: string) {
  return {
    id: `employment-end-${endDate}`,
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    sequenceId: 'sequence-1',
    endDate,
    status: 'ACTIVE' as const,
    reason: 'Zakończenie współpracy',
    createdAt,
    createdBy: 'test',
    updatedAt: createdAt,
    updatedBy: 'test',
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
  monthId = '2026-06',
  target = employee(),
  dailyValues = [],
  absences = [],
  settings = defaultPayrollSettings(),
  adjustments = [],
  entitlements = null,
  calendarOptions = {},
  plannedSchedule,
  depositReturnOverride = null,
  holidayWorkBonusDecision = null,
  depositWithholdingEvidence = null,
}: {
  monthId?: MonthId;
  target?: Employee;
  dailyValues?: DailyValue[];
  absences?: Absence[];
  settings?: PayrollSetting[];
  adjustments?: Adjustment[];
  entitlements?: EmployeeSettlementEntitlements | null;
  calendarOptions?: PayrollCalendarOptions;
  plannedSchedule?: PlannedScheduleDay[];
  depositReturnOverride?: number | null;
  holidayWorkBonusDecision?: HolidayWorkBonusDecision | null;
  depositWithholdingEvidence?: HousingDepositWithholdingEvidence | null;
} = {}) {
  return calculateEmployeeMonthlyDraft({
    monthId,
    employee: target,
    dailyValues,
    absences,
    payrollSettings: settings,
    adjustments,
    entitlements,
    calendarOptions,
    plannedSchedule,
    depositReturnOverride,
    holidayWorkBonusDecision,
    depositWithholdingEvidence,
  });
}

function normativeSchedule(monthId: MonthId = '2026-06'): PlannedScheduleDay[] {
  return createPayrollMonthCalendar(monthId).map((day) => {
    const working = day.isWorkingDay;
    return {
      employeeId: 'employee-1',
      date: day.isoDate,
      status: working ? 'WORKING' : 'DAY_OFF',
      source: working ? 'automatic' : 'calendar',
      hours: working ? 8 : 0,
      shift: working ? 'FIRST' : null,
      label: working ? '8 / 1' : 'W',
      departmentId: null,
      shiftAssignment: null,
      reason: null,
      holidayName: null,
      plannedStartTime: working ? '06:00' : null,
      plannedEndTime: working ? '14:00' : null,
      plannedDuration: working ? 8 : 0,
    };
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

  it('keeps nominal unchanged when several normatively free days contain extra work', () => {
    const result = draft({
      plannedSchedule: normativeSchedule(),
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-06-06',
          date: '2026-06-06',
          hours: 4,
          workTimeCorrection: {
            workContext: 'EXTRA',
            plannedShift: null,
            plannedStartTime: null,
            plannedEndTime: null,
            actualStartTime: '06:00',
            actualEndTime: '10:00',
            classificationOverride: null,
          },
        }),
        dailyValue({
          id: 'employee-1_2026-06-07',
          date: '2026-06-07',
          hours: 8.5,
          workTimeCorrection: {
            workContext: 'EXTRA',
            plannedShift: null,
            plannedStartTime: null,
            plannedEndTime: null,
            actualStartTime: '06:00',
            actualEndTime: '14:30',
            classificationOverride: null,
          },
        }),
      ],
    });

    expect(result.totals.nominalHours).toBe(22 * STANDARD_WORKING_DAY_HOURS);
    expect(result.workTime.normalWorkHours).toBe(
      22 * STANDARD_WORKING_DAY_HOURS,
    );
    expect(result.workTime.overtime100Hours).toBe(12);
    expect(result.workTime.overtime50Hours).toBe(0.5);
    expect(result.workTime.niedoczasHours).toBe(0);
  });

  it('settles 7 August day off, spanning L4, and actual work without a holiday bonus', () => {
    const dayOffSchedule = normativeSchedule('2026-08').map((day) =>
      day.date === '2026-08-07'
        ? {
            ...day,
            status: 'DAY_OFF' as const,
            source: 'manual-correction' as const,
            hours: 0,
            shift: null,
            label: 'W',
            reason: 'Wolne za święto',
            plannedStartTime: null,
            plannedEndTime: null,
            plannedDuration: 0,
          }
        : day,
    );
    const withL4 = draft({
      monthId: '2026-08',
      plannedSchedule: dayOffSchedule,
      absences: [
        absence({
          id: 'l4-over-day-off',
          monthId: '2026-08',
          startDate: '2026-08-06',
          endDate: '2026-08-10',
        }),
      ],
    });
    const withEightHours = draft({
      monthId: '2026-08',
      plannedSchedule: dayOffSchedule,
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-08-07',
          monthId: '2026-08',
          date: '2026-08-07',
          hours: 8,
          workTimeCorrection: {
            workContext: 'EXTRA',
            plannedShift: null,
            plannedStartTime: null,
            plannedEndTime: null,
            actualStartTime: '06:00',
            actualEndTime: '14:00',
            classificationOverride: null,
          },
        }),
      ],
    });
    const withTenHours = draft({
      monthId: '2026-08',
      plannedSchedule: dayOffSchedule,
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-08-07',
          monthId: '2026-08',
          date: '2026-08-07',
          hours: 10,
          workTimeCorrection: {
            workContext: 'EXTRA',
            plannedShift: null,
            plannedStartTime: null,
            plannedEndTime: null,
            actualStartTime: '06:00',
            actualEndTime: '16:00',
            classificationOverride: null,
          },
        }),
      ],
    });

    expect(withL4.totals.nominalHours).toBe(160);
    expect(withL4.absences.l4Hours).toBe(16);
    expect(withL4.absences.periods[0]).toMatchObject({
      startDate: '2026-08-06',
      endDate: '2026-08-10',
      workingDayCount: 2,
      workingHours: 16,
    });
    expect(withEightHours.workTime.overtime100Hours).toBe(8);
    expect(withEightHours.workTime.overtime50Hours).toBe(0);
    expect(withEightHours.workTime.niedoczasHours).toBe(0);
    expect(withEightHours.components.holidayWorkBonusBrutto).toBe(0);
    expect(withTenHours.workTime.overtime100Hours).toBe(8);
    expect(withTenHours.workTime.overtime50Hours).toBe(2);
    expect(withTenHours.workTime.niedoczasHours).toBe(0);
    expect(withTenHours.components.holidayWorkBonusBrutto).toBe(0);
  });

  it('treats consecutive contracts as full-month coverage for monthly allowances', () => {
    const target = employee({
      contracts: [
        {
          ...employee().contracts![0]!,
          id: 'first-half',
          startDate: '2026-06-01',
          endDate: '2026-06-15',
        },
        {
          ...employee().contracts![0]!,
          id: 'second-half',
          startDate: '2026-06-16',
          endDate: '2026-08-31',
        },
      ],
    });
    const result = draft({
      target,
      entitlements: {
        udtEligible: true,
        ownHousingAllowanceEligible: true,
      },
      settings: [
        ...defaultPayrollSettings(),
        payrollSetting({
          id: 'own-housing',
          settingKey: 'own_housing_allowance',
          amount: 200,
        }),
      ],
    });

    expect(result.employment.fullCalendarMonth).toBe(true);
    expect(result.components.udtAllowanceBrutto).toBe(300);
    expect(result.components.ownHousingAllowanceBrutto).toBe(200);
    expect(result.totals.frequencyBonusAmount).toBe(400);
  });

  it('preserves a real gap between explicitly separated employment lifecycles', () => {
    const target = employee({
      contracts: [
        {
          ...employee().contracts![0]!,
          id: 'first-half',
          startDate: '2026-06-01',
          endDate: '2026-06-15',
        },
        {
          ...employee().contracts![0]!,
          id: 'second-half',
          sequenceId: 'sequence-2',
          startDate: '2026-06-17',
          endDate: '2026-08-31',
        },
      ],
      employmentEndEvents: [explicitEmploymentEnd('2026-06-15')],
    });

    expect(draft({ target }).employment.fullCalendarMonth).toBe(false);
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

    expect(result.absences.periods).toMatchObject([
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

  it('sets the frequency bonus to zero for NN', () => {
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

  it('uses the full-month nominal denominator for transport and laundry after a mid-month hire', () => {
    const result = draft({
      target: employee({ employmentStartDate: utcDate('2026-06-15') }),
    });

    expect(result.workDays.eligibleWorkingDays).toBe(12);
    expect(result.workDays.physicallyWorkedDays).toBe(12);
    expect(result.components.transportAllowanceNetto).toBe(150);
    expect(result.components.laundryAllowanceBrutto).toBe(21.82);
  });

  it('counts explicit work on a free day but caps transport and laundry at their monthly maximum', () => {
    const result = draft({
      plannedSchedule: normativeSchedule(),
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-06-06',
          date: '2026-06-06',
          hours: 4,
        }),
      ],
    });

    expect(result.workDays.physicallyWorkedDays).toBe(23);
    expect(result.components.transportAllowanceNetto).toBe(275);
    expect(result.components.laundryAllowanceBrutto).toBe(40);
  });

  it('counts explicit positive hours for allowances even when the same day has an absence conflict', () => {
    const result = draft({
      dailyValues: [dailyValue({ date: '2026-06-01', hours: 8 })],
      absences: [absence({ startDate: '2026-06-01', endDate: '2026-06-01' })],
    });

    expect(result.workDays.physicallyWorkedDays).toBe(22);
    expect(result.components.transportAllowanceNetto).toBe(275);
    expect(result.components.laundryAllowanceBrutto).toBe(40);
    expect(result.warnings.map((item) => item.code)).toContain(
      'attendance-absence-conflict',
    );
  });

  it('automatically applies the holiday bonus once per month', () => {
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
    expect(result.components.holidayWorkBonusSuggestedBrutto).toBe(300);
    expect(result.components.holidayWorkBonusDecision).toBe('CONFIRMED');
    expect(result.warnings.map((item) => item.code)).not.toContain(
      'holiday-work-bonus-confirmation-required',
    );
  });

  it('keeps the holiday suggestion but applies the coordinator confirmation or rejection', () => {
    const input = {
      dailyValues: [
        dailyValue({
          id: 'employee-1_2026-06-04',
          date: '2026-06-04',
          hours: 8,
        }),
      ],
      calendarOptions: {
        publicHolidays: new Set(['2026-06-04']),
      },
    };

    const confirmed = draft({
      ...input,
      holidayWorkBonusDecision: 'CONFIRMED',
    });
    const rejected = draft({
      ...input,
      holidayWorkBonusDecision: 'REJECTED',
    });

    expect(confirmed.components.holidayWorkBonusBrutto).toBe(300);
    expect(confirmed.components.holidayWorkBonusDecision).toBe('CONFIRMED');
    expect(confirmed.warnings.map((item) => item.code)).not.toContain(
      'holiday-work-bonus-confirmation-required',
    );
    expect(rejected.components.holidayWorkBonusSuggestedBrutto).toBe(300);
    expect(rejected.components.holidayWorkBonusBrutto).toBe(0);
    expect(rejected.components.holidayWorkBonusDecision).toBe('REJECTED');
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
          startDate: '2026-06-08',
          endDate: '2026-06-08',
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
      'unresolved-time-off-allocation',
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
        target: employee({
          employmentEndDate: utcDate('2026-06-29'),
          employmentEndEvents: [explicitEmploymentEnd('2026-06-29')],
        }),
        entitlements: { udtEligible: true },
      }).components.udtAllowanceBrutto,
    ).toBe(0);

    expect(
      draft({
        absences: [absence({ startDate: '2026-06-01' })],
        entitlements: { udtEligible: true },
      }).components.udtAllowanceBrutto,
    ).toBe(300);

    const partial = draft({
      entitlements: { udtEligible: false, udtCoverage: 'PARTIAL' },
    });
    expect(partial.components.udtAllowanceBrutto).toBe(0);
    expect(partial.warnings.map((item) => item.code)).toContain(
      'udt-entitlement-incomplete',
    );
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
        payrollSetting({
          id: 'type-a-media',
          settingKey: 'company_housing_media',
          variantKey: 'type-a',
          variantName: 'Typ A',
          amount: 500,
        }),
      ],
    });

    expect(result.components.companyAccommodationMediaDeduction).toBe(250);
    expect(result.components.companyAccommodationRentDeduction).toBe(75);
    expect(result.components.companyAccommodationDeduction).toBe(325);
  });

  it.each([
    ['2026-02', 28],
    ['2028-02', 29],
    ['2026-04', 30],
    ['2026-07', 31],
  ] as const)(
    'uses all %s calendar days as the housing denominator',
    (monthId, daysInMonth) => {
      const result = draft({
        monthId,
        entitlements: {
          companyAccommodationPeriods: [
            {
              entitlementId: 'company',
              episodeId: 'company',
              variantKey: 'type-a',
              validFrom: `${monthId}-01`,
              validTo: `${monthId}-01`,
            },
          ],
        },
        settings: [
          payrollSetting({
            id: 'type-a',
            settingKey: 'accommodation_allowance',
            variantKey: 'type-a',
            amount: 500,
          }),
          payrollSetting({
            id: 'type-a-media',
            settingKey: 'company_housing_media',
            variantKey: 'type-a',
            amount: 150,
          }),
        ],
      });

      expect(result.components.companyAccommodationDeduction).toBeCloseTo(
        Math.round((500 / daysInMonth) * 100) / 100 +
          Math.round((150 / daysInMonth) * 100) / 100,
        2,
      );
    },
  );

  it('sums several company housing periods without charging the own-housing gap', () => {
    const result = draft({
      monthId: '2026-06',
      entitlements: {
        companyAccommodationPeriods: [
          {
            entitlementId: 'first',
            episodeId: 'first',
            variantKey: 'type-a',
            validFrom: '2026-06-01',
            validTo: '2026-06-10',
          },
          {
            entitlementId: 'second',
            episodeId: 'second',
            variantKey: 'type-a',
            validFrom: '2026-06-20',
            validTo: '2026-06-30',
          },
        ],
      },
      settings: [
        payrollSetting({
          id: 'type-a',
          settingKey: 'accommodation_allowance',
          variantKey: 'type-a',
          amount: 500,
        }),
        payrollSetting({
          id: 'type-a-media',
          settingKey: 'company_housing_media',
          variantKey: 'type-a',
          amount: 150,
        }),
      ],
    });

    expect(result.components.companyAccommodationDeduction).toBe(455);
  });

  it('keeps charging company housing after a fixed-term contract expiry without termination', () => {
    const target = employee({
      contracts: [
        {
          ...employee().contracts![0]!,
          endDate: '2026-06-15',
        },
      ],
    });
    const result = draft({
      target,
      entitlements: {
        companyAccommodation: {
          variantKey: 'type-a',
          contractStartDate: utcDate('2026-06-01'),
          contractEndDate: null,
        },
      },
      settings: [
        payrollSetting({
          id: 'type-a',
          settingKey: 'accommodation_allowance',
          variantKey: 'type-a',
          amount: 500,
        }),
        payrollSetting({
          id: 'type-a-media',
          settingKey: 'company_housing_media',
          variantKey: 'type-a',
          amount: 150,
        }),
      ],
    });

    expect(result.components.companyAccommodationDeduction).toBe(650);
  });

  it('stops charging company housing on the explicit employment end date', () => {
    const result = draft({
      target: employee({
        employmentEndDate: utcDate('2026-06-15'),
        employmentEndEvents: [explicitEmploymentEnd('2026-06-15')],
      }),
      entitlements: {
        companyAccommodationPeriods: [
          {
            entitlementId: 'company',
            episodeId: 'company',
            variantKey: 'type-a',
            validFrom: '2026-06-01',
            validTo: null,
          },
        ],
      },
      settings: [
        payrollSetting({
          id: 'type-a',
          settingKey: 'accommodation_allowance',
          variantKey: 'type-a',
          amount: 500,
        }),
        payrollSetting({
          id: 'type-a-media',
          settingKey: 'company_housing_media',
          variantKey: 'type-a',
          amount: 150,
        }),
      ],
    });

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

  it('does not return the housing deposit when only the fixed-term contract expires', () => {
    const result = draft({
      target: employee({ employmentEndDate: utcDate('2026-06-30') }),
      entitlements: {
        companyAccommodation: {
          variantKey: 'type-a',
          contractStartDate: utcDate('2026-01-10'),
          contractEndDate: null,
          episodeId: 'housing-episode-1',
        },
      },
      settings: [
        ...defaultPayrollSettings(),
        payrollSetting({
          id: 'deposit',
          settingKey: 'housing_deposit',
          amount: 99,
          taxType: 'NET',
          validFrom: '2026-01',
        }),
      ],
      depositWithholdingEvidence: {
        episodeId: 'housing-episode-1',
        amount: 99,
        monthId: '2026-01',
      },
    });

    expect(result.components.housingDepositReturnDue).toBe(false);
    expect(result.components.housingDepositReturn).toBe(0);
  });

  it('returns the housing deposit in the final salary after an explicit coordinator termination', () => {
    const target = employee({
      employmentEndDate: utcDate('2026-06-30'),
      employmentEndEvents: [
        {
          id: 'employment-end-1',
          employeeId: 'employee-1',
          tetaNumber: 'T001',
          sequenceId: 'sequence-1',
          endDate: '2026-06-30',
          status: 'ACTIVE',
          reason: 'Zakończenie współpracy',
          createdAt,
          createdBy: 'coordinator',
          updatedAt: createdAt,
          updatedBy: 'coordinator',
        },
      ],
    });
    const result = draft({
      target,
      entitlements: {
        companyAccommodation: {
          variantKey: 'type-a',
          contractStartDate: utcDate('2026-01-10'),
          contractEndDate: null,
          episodeId: 'housing-episode-1',
        },
      },
      settings: [
        ...defaultPayrollSettings(),
        payrollSetting({
          id: 'deposit',
          settingKey: 'housing_deposit',
          amount: 99,
          taxType: 'NET',
          validFrom: '2026-01',
        }),
      ],
      depositWithholdingEvidence: {
        episodeId: 'housing-episode-1',
        amount: 99,
        monthId: '2026-01',
      },
    });

    expect(result.components.housingDepositReturnDue).toBe(true);
    expect(result.components.housingDepositPriorWithholdingProven).toBe(true);
    expect(result.components.housingDepositReturn).toBe(99);
    expect(result.totals.returns).toBe(99);
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
        absences: [
          absence({ startDate: '2026-06-01', endDate: '2026-06-10' }),
          absence({
            id: 'uw-1',
            absenceCode: 'UW',
            startDate: '2026-06-11',
            endDate: '2026-06-20',
          }),
        ],
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
    expect(
      draft({
        target: employee({
          employmentEndDate: utcDate('2026-06-29'),
          employmentEndEvents: [explicitEmploymentEnd('2026-06-29')],
        }),
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

  it('calculates monthly participation exclusively from contract history', () => {
    const worker = employee({
      employmentStartDate: null,
      employmentEndDate: null,
      contracts: [
        {
          ...employee().contracts![0]!,
          startDate: '2026-06-10',
          endDate: '2026-06-30',
        },
      ],
    });

    const [result] = calculateMonthlyDrafts({
      monthId: '2026-06',
      employees: [worker],
      dailyValues: [],
      absences: [],
      payrollSettings: defaultPayrollSettings(),
      adjustments: [],
    });

    expect(result?.employment.participatesInMonth).toBe(true);
    expect(result?.employment.individualNominalHours).toBeGreaterThan(0);
  });

  it('automatically aggregates own housing without a manual entitlement', () => {
    const employees = [employee()];
    const entitlementsByEmployeeId = resolveMonthlyEmployeeEntitlements({
      monthId: '2026-06',
      employees,
      entitlements: [entitlement({ type: 'UDT' })],
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
