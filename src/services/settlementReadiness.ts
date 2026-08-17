import type { EmployeeMonthlyCalculationDraft } from '../utils/payroll';
import type { ExportReadinessWarning } from '../utils/reports';
import { isMonthlyCalculationBlocker } from './monthlyCalculationService';

export type SettlementReadinessSeverity = 'BLOCKER' | 'WARNING';

export interface SettlementReadinessIssue {
  severity: SettlementReadinessSeverity;
  code: string;
  employeeId: string | null;
  tetaNumber: string | null;
}

export interface SettlementReadiness {
  blockers: SettlementReadinessIssue[];
  warnings: SettlementReadinessIssue[];
  canClose: boolean;
}

export function buildSettlementReadiness({
  drafts,
  exportWarnings,
}: {
  drafts: readonly EmployeeMonthlyCalculationDraft[];
  exportWarnings: readonly ExportReadinessWarning[];
}): SettlementReadiness {
  const issues: SettlementReadinessIssue[] = [];

  drafts.forEach((draft) => {
    draft.warnings.forEach((warning) => {
      issues.push({
        severity: isMonthlyCalculationBlocker(warning.code)
          ? 'BLOCKER'
          : 'WARNING',
        code: warning.code,
        employeeId: draft.employeeId,
        tetaNumber: draft.tetaNumber,
      });
    });
    if (draft.components.holidayWorkBonusDecision === 'REJECTED') {
      issues.push({
        severity: 'WARNING',
        code: 'holiday-work-bonus-manually-cancelled',
        employeeId: draft.employeeId,
        tetaNumber: draft.tetaNumber,
      });
    }
    if (
      draft.components.housingDepositReturnDue &&
      draft.components.housingDepositReturn !==
        draft.components.housingDepositAutomaticReturn
    ) {
      issues.push({
        severity: 'WARNING',
        code: 'housing-deposit-return-manually-adjusted',
        employeeId: draft.employeeId,
        tetaNumber: draft.tetaNumber,
      });
    }
  });

  exportWarnings.forEach((warning) => {
    issues.push({ ...warning });
  });

  const blockers = issues.filter((issue) => issue.severity === 'BLOCKER');
  const warnings = issues.filter((issue) => issue.severity === 'WARNING');
  return { blockers, warnings, canClose: blockers.length === 0 };
}
