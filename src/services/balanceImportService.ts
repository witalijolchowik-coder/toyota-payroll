import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth } from '../config/firebase';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import { dailyValueDocumentId } from './firestore/paths';
import type {
  BalanceSourceFactsDocument,
  DailyValueDocument,
  MonthId,
} from '../types/firestore';

export interface BalanceDailyValueInput {
  employeeId: string;
  tetaNumber: string;
  date: string;
  facts: BalanceSourceFactsDocument;
}
export type BalanceUpsertResult =
  'inserted' | 'updated' | 'unchanged' | 'manual-preserved';

/** Source refresh never replaces an intentional operator value/correction. */
export function planBalanceDailyValueUpsert(
  existing: DailyValueDocument | null,
  input: BalanceDailyValueInput,
) {
  const equal = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
      return false;
    const aa = a as Record<string, unknown>,
      bb = b as Record<string, unknown>;
    return (
      Object.keys(aa).length === Object.keys(bb).length &&
      Object.keys(aa).every((k) => equal(aa[k], bb[k]))
    );
  };
  const protectedManual =
    existing?.source === 'manual' ||
    !!existing?.manual_override ||
    !!existing?.work_time_correction;
  const patch =
    existing?.source === 'manual'
      ? { balance_source_facts: input.facts }
      : {
          hours: input.facts.credited_hours,
          import_id: input.facts.import_id,
          balance_source_facts: input.facts,
        };
  const unchanged =
    existing &&
    Object.entries(patch).every(([k, v]) =>
      equal(existing[k as keyof DailyValueDocument], v),
    );
  return {
    patch,
    result: unchanged
      ? 'unchanged'
      : protectedManual
        ? 'manual-preserved'
        : existing
          ? 'updated'
          : 'inserted',
  } as { patch: typeof patch; result: BalanceUpsertResult };
}

export async function upsertBalanceDailyValue(
  monthId: MonthId,
  input: BalanceDailyValueInput,
): Promise<BalanceUpsertResult> {
  const db = getFirestoreClient(),
    repositories = getFirestoreRepositories();
  await auth?.authStateReady();
  const uid = auth?.currentUser?.uid;
  if (!db || !repositories || !uid) throw Error('authentication-required');
  if (
    input.date.slice(0, 7) !== monthId ||
    input.facts.credited_hours < 0 ||
    input.facts.credited_hours > 24 ||
    !input.facts.import_id
  )
    throw Error('invalid-source');
  const month = repositories.forMonth(monthId);
  const ref = doc(
    month.dailyValues,
    dailyValueDocumentId(input.employeeId, input.date),
  );
  const audit = doc(repositories.auditLog);
  return runTransaction(db, async (tx) => {
    const [monthSnapshot, snapshot] = await Promise.all([
      tx.get(month.month),
      tx.get(ref),
    ]);
    if (!monthSnapshot.exists() || monthSnapshot.data().is_settled)
      throw Error('month-locked');
    const existing = snapshot.exists() ? snapshot.data() : null;
    if (
      existing &&
      (existing.employee_id !== input.employeeId ||
        existing.teta_number !== input.tetaNumber)
    )
      throw Error('identity-conflict');
    const plan = planBalanceDailyValueUpsert(existing, input);
    if (plan.result === 'unchanged') return plan.result;
    if (existing)
      tx.update(ref, {
        ...plan.patch,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    else
      tx.set(ref, {
        employee_id: input.employeeId,
        teta_number: input.tetaNumber,
        date: input.date,
        hours: input.facts.credited_hours,
        source: 'attendance_import',
        import_id: input.facts.import_id,
        note: null,
        manual_override: null,
        // Raw punches live only in typed facts, never in an operator correction.
        work_time_correction: null,
        balance_source_facts: input.facts,
        created_at: serverTimestamp(),
        created_by: uid,
        updated_at: serverTimestamp(),
        updated_by: uid,
      });
    tx.set(audit, {
      entity_path: ref.path,
      action: existing ? 'update' : 'create',
      actor_uid: uid,
      occurred_at: serverTimestamp(),
      changes: {
        change_kind: 'balance-source-import',
        import_id: input.facts.import_id,
        worksheet: input.facts.worksheet,
        row: input.facts.row,
        employee_id: input.employeeId,
        teta_number: input.tetaNumber,
        date: input.date,
        manual_preserved: plan.result === 'manual-preserved',
        previous_source_facts: existing?.balance_source_facts ?? null,
        new_source_facts: input.facts,
      },
    });
    return plan.result;
  });
}
