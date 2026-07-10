import type {
  EmployeeId,
  SettlementReviewState,
  SettlementReviewStatus,
} from '../../types/firestore';
import type {
  EmployeeMonthlyCalculationDraft,
  PayrollDraftWarning,
  PayrollDraftWarningCode,
} from './calculationDraft';

export type SettlementReviewIssueCode =
  | PayrollDraftWarningCode
  | 'uncovered-private-time'
  | 'uncovered-coverable-ni'
  | 'niedoczas';

export type SettlementReviewIssueGroup =
  | 'employment'
  | 'attendance'
  | 'absences'
  | 'workTime'
  | 'components'
  | 'configuration';

export interface SettlementReviewIssue {
  code: SettlementReviewIssueCode;
  date: string | null;
  group: SettlementReviewIssueGroup;
}

export interface EmployeeSettlementReviewItem {
  draft: EmployeeMonthlyCalculationDraft;
  reviewState: SettlementReviewState | null;
  effectiveStatus: SettlementReviewStatus;
  issues: SettlementReviewIssue[];
  unresolvedIssueCount: number;
}

export interface SettlementReviewSummary {
  totalEmployees: number;
  checkedEmployees: number;
  requiresCorrectionEmployees: number;
  employeesWithWarnings: number;
  employeesWithUnresolvedComponents: number;
  notReviewedEmployees: number;
  totalWarnings: number;
  readyForFutureExport: boolean;
}

const unresolvedIssueCodes = new Set<SettlementReviewIssueCode>([
  'unresolved-frequency-bonus-setting',
  'unresolved-work-time-classification',
  'company-accommodation-missing-variant',
  'unresolved-company-accommodation-variant',
  'unresolved-own-housing-setting',
  'housing-entitlement-conflict',
  'uncovered-private-time',
  'uncovered-coverable-ni',
  'niedoczas',
]);

export function isValidSettlementReviewStatus(
  value: string,
): value is SettlementReviewStatus {
  return ['DRAFT', 'NEEDS_REVIEW', 'NEEDS_CORRECTION', 'CHECKED'].includes(
    value,
  );
}

export function isUnresolvedSettlementReviewIssue(
  issue: SettlementReviewIssue,
): boolean {
  return unresolvedIssueCodes.has(issue.code);
}

export function groupPayrollDraftWarning(
  warning: PayrollDraftWarning,
): SettlementReviewIssueGroup {
  if (
    warning.code === 'missing-employment-start' ||
    warning.code === 'employee-not-participating'
  ) {
    return 'employment';
  }
  if (
    warning.code === 'attendance-absence-conflict' ||
    warning.code === 'attendance-outside-employment' ||
    warning.code === 'explicit-non-working-day'
  ) {
    return 'attendance';
  }
  if (
    warning.code === 'absence-outside-employment' ||
    warning.code === 'ambiguous-absence'
  ) {
    return 'absences';
  }
  if (warning.code === 'unresolved-work-time-classification') {
    return 'workTime';
  }
  if (
    warning.code === 'unresolved-frequency-bonus-setting' ||
    warning.code === 'unresolved-company-accommodation-variant' ||
    warning.code === 'unresolved-own-housing-setting'
  ) {
    return 'configuration';
  }
  return 'components';
}

export function settlementReviewIssuesFromDraft(
  draft: EmployeeMonthlyCalculationDraft,
): SettlementReviewIssue[] {
  const issues: SettlementReviewIssue[] = draft.warnings.map((warning) => ({
    code: warning.code,
    date: warning.date,
    group: groupPayrollDraftWarning(warning),
  }));

  if (draft.workTime.uncoveredPrivateTimeHours > 0) {
    issues.push({
      code: 'uncovered-private-time',
      date: null,
      group: 'workTime',
    });
  }
  if (draft.workTime.uncoveredCoverableNiHours > 0) {
    issues.push({
      code: 'uncovered-coverable-ni',
      date: null,
      group: 'workTime',
    });
  }
  if (draft.workTime.niedoczasHours > 0) {
    issues.push({ code: 'niedoczas', date: null, group: 'workTime' });
  }

  return issues;
}

export function buildSettlementReviewItems({
  drafts,
  reviewStates,
}: {
  drafts: readonly EmployeeMonthlyCalculationDraft[];
  reviewStates: readonly SettlementReviewState[];
}): EmployeeSettlementReviewItem[] {
  const statesByEmployeeId = new Map<EmployeeId, SettlementReviewState>(
    reviewStates.map((state) => [state.employeeId, state]),
  );

  return drafts.map((draft) => {
    const reviewState = statesByEmployeeId.get(draft.employeeId) ?? null;
    const issues = settlementReviewIssuesFromDraft(draft);
    return {
      draft,
      reviewState,
      effectiveStatus: reviewState?.reviewStatus ?? 'DRAFT',
      issues,
      unresolvedIssueCount: issues.filter(isUnresolvedSettlementReviewIssue)
        .length,
    };
  });
}

export function calculateSettlementReviewSummary(
  items: readonly EmployeeSettlementReviewItem[],
): SettlementReviewSummary {
  const totalEmployees = items.length;
  const checkedEmployees = items.filter(
    (item) => item.effectiveStatus === 'CHECKED',
  ).length;
  const requiresCorrectionEmployees = items.filter(
    (item) => item.effectiveStatus === 'NEEDS_CORRECTION',
  ).length;
  const employeesWithWarnings = items.filter(
    (item) => item.issues.length > 0,
  ).length;
  const employeesWithUnresolvedComponents = items.filter(
    (item) => item.unresolvedIssueCount > 0,
  ).length;
  const notReviewedEmployees = items.filter(
    (item) =>
      item.effectiveStatus === 'DRAFT' ||
      item.effectiveStatus === 'NEEDS_REVIEW',
  ).length;
  const totalWarnings = items.reduce(
    (total, item) => total + item.issues.length,
    0,
  );

  return {
    totalEmployees,
    checkedEmployees,
    requiresCorrectionEmployees,
    employeesWithWarnings,
    employeesWithUnresolvedComponents,
    notReviewedEmployees,
    totalWarnings,
    readyForFutureExport:
      totalEmployees > 0 &&
      checkedEmployees === totalEmployees &&
      requiresCorrectionEmployees === 0 &&
      employeesWithUnresolvedComponents === 0,
  };
}
