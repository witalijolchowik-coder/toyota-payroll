import { describe, expect, it } from 'vitest';

import type { EmployeeMonthlyCalculationDraft } from '../utils/payroll';
import { buildSettlementReadiness } from './settlementReadiness';

function draft(
  overrides: Partial<EmployeeMonthlyCalculationDraft> = {},
): EmployeeMonthlyCalculationDraft {
  return {
    employeeId: 'employee-1',
    tetaNumber: 'TETA-1',
    warnings: [],
    components: {
      holidayWorkBonusDecision: 'CONFIRMED',
      housingDepositReturnDue: false,
      housingDepositReturn: 0,
      housingDepositAutomaticReturn: 0,
    },
    ...overrides,
  } as EmployeeMonthlyCalculationDraft;
}

describe('settlement readiness', () => {
  it('blocks technical calculation and export failures', () => {
    const readiness = buildSettlementReadiness({
      drafts: [
        draft({
          warnings: [
            {
              code: 'critical-read-failure',
              date: null,
              message: 'dailyValues',
            },
          ],
        }),
      ],
      exportWarnings: [
        {
          code: 'unsupported-columns',
          severity: 'BLOCKER',
          employeeId: 'employee-1',
          tetaNumber: 'TETA-1',
        },
      ],
    });

    expect(readiness.canClose).toBe(false);
    expect(readiness.blockers.map((issue) => issue.code)).toEqual([
      'critical-read-failure',
      'unsupported-columns',
    ]);
  });

  it('allows close with review facts and manual business decisions', () => {
    const item = draft();
    item.components.holidayWorkBonusDecision = 'REJECTED';
    item.components.housingDepositReturnDue = true;
    item.components.housingDepositAutomaticReturn = 99;
    item.components.housingDepositReturn = 20;
    item.warnings = [
      {
        code: 'housing-deposit-withholding-unproven',
        date: null,
        message: '',
      },
    ];
    const readiness = buildSettlementReadiness({
      drafts: [item],
      exportWarnings: [
        {
          code: 'not-reviewed',
          severity: 'WARNING',
          employeeId: 'employee-1',
          tetaNumber: 'TETA-1',
        },
      ],
    });

    expect(readiness.canClose).toBe(true);
    expect(readiness.warnings.map((issue) => issue.code)).toEqual([
      'housing-deposit-withholding-unproven',
      'holiday-work-bonus-manually-cancelled',
      'housing-deposit-return-manually-adjusted',
      'not-reviewed',
    ]);
  });
});
