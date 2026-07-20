import {
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type { MonthId } from '../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from '../utils/payroll';
import { firestorePaths } from './firestore/paths';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';

const BLOCKING_WARNINGS = new Set([
  'missing-employment-start',
  'missing-first-toyota-employment-date',
  'missing-teta',
  'missing-citizenship',
  'missing-soz-identity',
  'attendance-absence-conflict',
  'ambiguous-absence',
  'unconfirmed-l4',
  'unresolved-work-time-classification',
  'unresolved-wzn-link',
  'housing-entitlement-conflict',
  'company-accommodation-missing-variant',
  'unresolved-company-accommodation-variant',
  'unresolved-own-housing-setting',
  'unresolved-payroll-setting',
  'unresolved-housing-deposit-setting',
  'critical-read-failure',
]);

export type CalculationPersistenceResult =
  'persisted' | 'current' | 'busy' | 'locked';

export function createMonthlyCalculationInputHash(input: unknown) {
  const value = stableStringify(input);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function monthlyCalculationBlockerCount(
  drafts: readonly EmployeeMonthlyCalculationDraft[],
) {
  return drafts.reduce(
    (total, draft) =>
      total +
      draft.warnings.filter((warning) => BLOCKING_WARNINGS.has(warning.code))
        .length,
    0,
  );
}

export async function persistMonthlyCalculation({
  monthId,
  drafts,
  inputHash,
  force = false,
}: {
  monthId: MonthId;
  drafts: readonly EmployeeMonthlyCalculationDraft[];
  inputHash: string;
  force?: boolean;
}): Promise<CalculationPersistenceResult> {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  const actorUid = auth?.currentUser?.uid;
  if (!firestore || !repositories || !actorUid) {
    throw new Error('calculation-unavailable');
  }
  const monthRepository = repositories.forMonth(monthId);
  const runId = `${Date.now()}-${actorUid.slice(0, 8)}`;
  const started = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(monthRepository.month);
    if (!snapshot.exists()) throw new Error('month-unavailable');
    const month = snapshot.data();
    if (month.is_settled) return 'locked' as const;
    if (
      !force &&
      month.calculation_status === 'completed' &&
      month.calculation_input_hash === inputHash
    ) {
      return 'current' as const;
    }
    if (
      month.calculation_status === 'running' &&
      month.calculation_started_at &&
      Date.now() - month.calculation_started_at.toMillis() < 120_000
    ) {
      return 'busy' as const;
    }
    transaction.update(monthRepository.month, {
      calculation_status: 'running',
      calculation_started_at: serverTimestamp(),
      calculation_completed_at: null,
      calculation_error: null,
      calculation_input_hash: inputHash,
      calculation_run_id: runId,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    return 'started' as const;
  });
  if (started !== 'started') return started;

  try {
    const existing = await getDocs(monthRepository.employeeSettlements);
    const blockerCount = monthlyCalculationBlockerCount(drafts);
    const warningCount = drafts.reduce(
      (total, draft) => total + draft.warnings.length,
      0,
    );
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(monthRepository.month);
      if (!snapshot.exists()) throw new Error('month-unavailable');
      const month = snapshot.data();
      if (month.is_settled) throw new Error('month-locked');
      if (month.calculation_run_id !== runId)
        throw new Error('superseded-calculation');
      const version = month.calculation_version + 1;
      const currentIds = new Set(drafts.map((draft) => draft.employeeId));
      existing.docs.forEach((settlement) => {
        if (!currentIds.has(settlement.id)) transaction.delete(settlement.ref);
      });
      drafts.forEach((draft) => {
        const blockers = draft.warnings.filter((warning) =>
          BLOCKING_WARNINGS.has(warning.code),
        );
        transaction.set(
          doc(
            firestore,
            firestorePaths.employeeSettlements(monthId),
            draft.employeeId,
          ),
          {
            employee_id: draft.employeeId,
            teta_number: draft.tetaNumber,
            totals: {
              worked_hours: draft.totals.workedHours,
              absence_hours:
                draft.absences.l4Hours +
                draft.absences.vacationHours +
                draft.absences.otherAbsenceHours,
              adjustment_hours: draft.workTime.niedoczasHours,
              payable_hours:
                draft.workTime.normalWorkHours +
                draft.workTime.paidOvertime50Hours +
                draft.workTime.paidOvertime100Hours,
            },
            warnings: draft.warnings.map((warning) => warning.code),
            calculated_at: serverTimestamp(),
            calculation_version: version,
            calculation_run_id: runId,
            input_hash: inputHash,
            status: blockers.length ? 'blocked' : 'complete',
            blocker_count: blockers.length,
            warning_count: draft.warnings.length,
            result: serializeDraft(draft),
          },
        );
      });
      transaction.update(monthRepository.month, {
        calculation_status: 'completed',
        calculation_completed_at: serverTimestamp(),
        calculation_error: null,
        calculation_version: version,
        calculation_blocker_count: blockerCount,
        calculation_warning_count: warningCount,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
      transaction.set(doc(repositories.auditLog), {
        entity_path: firestorePaths.month(monthId),
        action: 'update',
        actor_uid: actorUid,
        occurred_at: serverTimestamp(),
        changes: {
          operation: force
            ? 'manual-month-recalculation'
            : 'automatic-month-recalculation',
          month_id: monthId,
          calculation_run_id: runId,
          calculation_version: version,
          input_hash: inputHash,
          employee_count: drafts.length,
          blocker_count: blockerCount,
          warning_count: warningCount,
          calculation_status: 'completed',
        },
      });
    });
    return 'persisted';
  } catch (error) {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(monthRepository.month);
      if (
        snapshot.exists() &&
        !snapshot.data().is_settled &&
        snapshot.data().calculation_run_id === runId
      ) {
        transaction.update(monthRepository.month, {
          calculation_status: 'failed',
          calculation_completed_at: serverTimestamp(),
          calculation_error:
            error instanceof Error ? error.message : 'calculation-failed',
          updated_at: serverTimestamp(),
          updated_by: actorUid,
        });
        transaction.set(doc(repositories.auditLog), {
          entity_path: firestorePaths.month(monthId),
          action: 'update',
          actor_uid: actorUid,
          occurred_at: serverTimestamp(),
          changes: {
            operation: force
              ? 'manual-month-recalculation-failed'
              : 'automatic-month-recalculation-failed',
            month_id: monthId,
            calculation_run_id: runId,
            input_hash: inputHash,
            calculation_status: 'failed',
            error:
              error instanceof Error ? error.message : 'calculation-failed',
          },
        });
      }
    });
    throw error;
  }
}

export async function setMonthLock(monthId: MonthId, locked: boolean) {
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  const actorUid = auth?.currentUser?.uid;
  if (!firestore || !repositories || !actorUid)
    throw new Error('calculation-unavailable');
  const monthRef = repositories.forMonth(monthId).month;
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(monthRef);
    if (!snapshot.exists()) throw new Error('month-unavailable');
    const month = snapshot.data();
    if (
      locked &&
      (month.calculation_status !== 'completed' ||
        (month.calculation_blocker_count ?? 0) > 0)
    ) {
      throw new Error('month-not-ready');
    }
    transaction.update(monthRef, {
      is_settled: locked,
      settled_at: locked ? serverTimestamp() : null,
      settled_by: locked ? actorUid : null,
      calculation_status: locked ? month.calculation_status : 'queued',
      calculation_input_hash: locked
        ? (month.calculation_input_hash ?? null)
        : null,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    transaction.set(doc(repositories.auditLog), {
      entity_path: firestorePaths.month(monthId),
      action: locked ? 'settle' : 'update',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        operation: locked ? 'month-locked' : 'month-unlocked',
        month_id: monthId,
        calculation_version: month.calculation_version,
        calculation_input_hash: month.calculation_input_hash ?? null,
      },
    });
  });
}

function serializeDraft(draft: EmployeeMonthlyCalculationDraft) {
  return JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).sort().join(',')}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}
