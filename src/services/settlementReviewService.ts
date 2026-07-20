import { getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { auth } from '../config/firebase';
import type { MonthId, SettlementReviewUpdateInput } from '../types/firestore';
import { getFirestoreRepositories } from './firestoreService';
import { recordAuditEntry } from './auditService';

export type SettlementReviewServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'month-settled';

export class SettlementReviewServiceError extends Error {
  constructor(readonly code: SettlementReviewServiceErrorCode) {
    super(code);
    this.name = 'SettlementReviewServiceError';
  }
}

async function requireContext(monthId: MonthId) {
  const repositories = getFirestoreRepositories();
  if (!repositories || !auth) {
    throw new SettlementReviewServiceError('firebase-unavailable');
  }
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new SettlementReviewServiceError('authentication-required');
  }
  const monthRepository = repositories.forMonth(monthId);
  const monthSnapshot = await getDoc(monthRepository.month);
  if (monthSnapshot.exists() && monthSnapshot.data().is_settled) {
    throw new SettlementReviewServiceError('month-settled');
  }
  return { uid, monthRepository };
}

function normalizeReviewInput(
  input: SettlementReviewUpdateInput,
): SettlementReviewUpdateInput {
  const normalized = {
    employeeId: input.employeeId.trim(),
    tetaNumber: input.tetaNumber.trim(),
    reviewStatus: input.reviewStatus,
    reviewNote: input.reviewNote.trim(),
    depositReturnOverride: input.depositReturnOverride ?? null,
    depositReturnNote: input.depositReturnNote?.trim() ?? '',
  };
  if (!normalized.employeeId || !normalized.tetaNumber) {
    throw new SettlementReviewServiceError('invalid-input');
  }
  if (
    normalized.depositReturnOverride !== null &&
    (!Number.isFinite(normalized.depositReturnOverride) ||
      normalized.depositReturnOverride < 0)
  ) {
    throw new SettlementReviewServiceError('invalid-input');
  }
  return normalized;
}

export async function saveSettlementReviewState(
  monthId: MonthId,
  input: SettlementReviewUpdateInput,
): Promise<void> {
  const normalized = normalizeReviewInput(input);
  const { uid, monthRepository } = await requireContext(monthId);
  const reference = monthRepository.reviewState(normalized.employeeId);
  const snapshot = await getDoc(reference);

  if (snapshot.exists()) {
    await updateDoc(reference, {
      review_status: normalized.reviewStatus,
      review_note: normalized.reviewNote,
      reviewed_at: serverTimestamp(),
      reviewed_by: uid,
      deposit_return_override: normalized.depositReturnOverride ?? null,
      deposit_return_note: normalized.depositReturnNote ?? '',
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  } else {
    await setDoc(reference, {
      month_id: monthId,
      employee_id: normalized.employeeId,
      teta_number: normalized.tetaNumber,
      review_status: normalized.reviewStatus,
      review_note: normalized.reviewNote,
      reviewed_at: serverTimestamp(),
      reviewed_by: uid,
      deposit_return_override: normalized.depositReturnOverride ?? null,
      deposit_return_note: normalized.depositReturnNote ?? '',
      created_at: serverTimestamp(),
      created_by: uid,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  }
  const previousOverride = snapshot.exists()
    ? snapshot.data().deposit_return_override
    : null;
  if (previousOverride !== normalized.depositReturnOverride) {
    await recordAuditEntry({
      entityPath: `months/${monthId}/reviewStates/${normalized.employeeId}`,
      action: 'update',
      actorUid: uid,
      changes: {
        operation: 'housing-deposit-return-adjusted',
        employee_id: normalized.employeeId,
        teta_number: normalized.tetaNumber,
        old_value: previousOverride,
        new_value: normalized.depositReturnOverride,
        note: normalized.depositReturnNote,
      },
    });
  }
}
