import type { SettlementReviewState } from '../../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from './calculationDraft';
import {
  buildSettlementReviewItems,
  calculateSettlementReviewSummary,
  groupPayrollDraftWarning,
  isValidSettlementReviewStatus,
  settlementReviewIssuesFromDraft,
} from './settlementReview';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function draft(
  overrides: Partial<EmployeeMonthlyCalculationDraft> = {},
): EmployeeMonthlyCalculationDraft {
  return {
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    monthId: '2026-06',
    employment: {
      employmentStart: createdAt,
      employmentEnd: null,
      participatesInMonth: true,
      fullCalendarMonth: true,
      individualNominalHours: 176,
    },
    attendance: {
      workedHoursTotal: 176,
      explicitHours: 0,
      manualHours: 0,
      importedHours: 0,
      importedOverrideHours: 0,
      virtualHours: 176,
      conflictDays: [],
      outsideEmploymentValueDays: [],
    },
    absences: {
      groups: [],
      periods: [],
      l4Hours: 0,
      vacationHours: 0,
      otherAbsenceHours: 0,
      nnHours: 0,
      approvedOrJustifiedHours: 0,
    },
    workDays: {
      eligibleWorkingDays: 22,
      physicallyWorkedDays: 22,
    },
    workTime: {
      normalWorkHours: 176,
      privateTimeHours: 0,
      privateTimeCoveredHours: 0,
      uncoveredPrivateTimeHours: 0,
      coverableNiHours: 0,
      coverableNiCoveredHours: 0,
      uncoveredCoverableNiHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      paidOvertime50Hours: 0,
      paidOvertime100Hours: 0,
      holidayWorkBonusEligible: false,
      unresolvedClassificationDays: [],
      niedoczasHours: 0,
    },
    bonuses: {
      frequency: {
        amount: 400,
        configuredSettingId: 'frequency',
        configuredAmount: 400,
        l4RecordCount: 0,
        hasNnAbsence: false,
        reason: 'ELIGIBLE',
      },
    },
    adjustments: {
      increases: 0,
      decreases: 0,
      entries: [],
    },
    components: {
      baseSalaryBrutto: 5_160,
      frequencyBonusBrutto: 400,
      holidayWorkBonusBrutto: 0,
      transportAllowanceNetto: 275,
      udtAllowanceBrutto: 0,
      laundryAllowanceBrutto: 40,
      ownHousingAllowanceBrutto: 0,
      manualIncreases: 0,
      manualDecreases: 0,
      companyAccommodationDeduction: 0,
      companyAccommodationMediaDeduction: 0,
      companyAccommodationRentDeduction: 0,
    },
    warnings: [],
    totals: {
      workedHours: 176,
      nominalHours: 176,
      frequencyBonusAmount: 400,
      manualIncreases: 0,
      manualDecreases: 0,
      bruttoAdditions: 440,
      nettoAllowances: 275,
      deductions: 0,
      preliminaryGrossAdditions: 440,
      preliminaryGrossDeductions: 0,
    },
    ...overrides,
  };
}

function reviewState(
  overrides: Partial<SettlementReviewState> = {},
): SettlementReviewState {
  return {
    id: 'employee-1',
    monthId: '2026-06',
    employeeId: 'employee-1',
    tetaNumber: 'T001',
    reviewStatus: 'CHECKED',
    reviewNote: '',
    reviewedAt: createdAt,
    reviewedBy: 'coordinator',
    createdAt,
    createdBy: 'coordinator',
    updatedAt: createdAt,
    updatedBy: 'coordinator',
    ...overrides,
  };
}

describe('settlement review helpers', () => {
  it('validates review statuses', () => {
    expect(isValidSettlementReviewStatus('CHECKED')).toBe(true);
    expect(isValidSettlementReviewStatus('DONE')).toBe(false);
  });

  it('marks a month ready only when every employee is checked and unresolved issues are absent', () => {
    const items = buildSettlementReviewItems({
      drafts: [
        draft(),
        draft({ employeeId: 'employee-2', tetaNumber: 'T002' }),
      ],
      reviewStates: [
        reviewState(),
        reviewState({ id: 'employee-2', employeeId: 'employee-2' }),
      ],
    });

    expect(calculateSettlementReviewSummary(items)).toMatchObject({
      totalEmployees: 2,
      checkedEmployees: 2,
      notReviewedEmployees: 0,
      readyForFutureExport: true,
    });
  });

  it('keeps readiness false when an employee is not reviewed', () => {
    const summary = calculateSettlementReviewSummary(
      buildSettlementReviewItems({
        drafts: [draft()],
        reviewStates: [],
      }),
    );

    expect(summary.notReviewedEmployees).toBe(1);
    expect(summary.readyForFutureExport).toBe(false);
  });

  it('keeps readiness false when an employee requires correction', () => {
    const summary = calculateSettlementReviewSummary(
      buildSettlementReviewItems({
        drafts: [draft()],
        reviewStates: [reviewState({ reviewStatus: 'NEEDS_CORRECTION' })],
      }),
    );

    expect(summary.requiresCorrectionEmployees).toBe(1);
    expect(summary.readyForFutureExport).toBe(false);
  });

  it('keeps readiness false when unresolved warnings exist', () => {
    const summary = calculateSettlementReviewSummary(
      buildSettlementReviewItems({
        drafts: [
          draft({
            warnings: [
              {
                code: 'unresolved-company-accommodation-variant',
                date: null,
                message: 'test',
              },
            ],
          }),
        ],
        reviewStates: [reviewState()],
      }),
    );

    expect(summary.employeesWithUnresolvedComponents).toBe(1);
    expect(summary.readyForFutureExport).toBe(false);
  });

  it('groups warnings for correction navigation', () => {
    expect(
      groupPayrollDraftWarning({
        code: 'attendance-absence-conflict',
        date: '2026-06-01',
        message: 'test',
      }),
    ).toBe('attendance');
    expect(
      groupPayrollDraftWarning({
        code: 'unresolved-frequency-bonus-setting',
        date: null,
        message: 'test',
      }),
    ).toBe('configuration');
  });

  it('adds derived work-time review issues without mutating calculation draft totals', () => {
    const source = draft({
      workTime: {
        ...draft().workTime,
        uncoveredPrivateTimeHours: 2,
        niedoczasHours: 1,
      },
    });
    const before = source.totals.bruttoAdditions;

    const issues = settlementReviewIssuesFromDraft(source);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['uncovered-private-time', 'niedoczas']),
    );
    expect(source.totals.bruttoAdditions).toBe(before);
  });
});
