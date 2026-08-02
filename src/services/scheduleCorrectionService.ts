import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  ActualWorkingShift,
  IsoDate,
  MonthId,
  ScheduleCorrection,
  ScheduleCorrectionDocument,
  ScheduleCorrectionKind,
  TetaNumber,
} from '../types/firestore';
import {
  getFirestoreClient,
  getFirestoreRepositories,
} from './firestoreService';
import { scheduleCorrectionDocumentId } from './firestore/paths';

export type ScheduleCorrectionServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'invalid-correction';

export class ScheduleCorrectionServiceError extends Error {
  constructor(readonly code: ScheduleCorrectionServiceErrorCode) {
    super(code);
    this.name = 'ScheduleCorrectionServiceError';
  }
}

export interface DailyShiftCorrectionInput {
  employeeId: string;
  tetaNumber: TetaNumber;
  date: IsoDate;
  plannedShift: ActualWorkingShift;
  plannedHours: number;
  note: string | null;
}

export function scheduleCorrectionKindForShift(
  shift: ActualWorkingShift,
): ScheduleCorrectionKind {
  if (shift === 'FIRST') return 'FIRST_SHIFT';
  if (shift === 'SECOND') return 'SECOND_SHIFT';
  return 'NIGHT_SHIFT';
}

export function isDailyShiftCorrectionUnchanged(
  existing: Pick<
    ScheduleCorrectionDocument,
    'status' | 'kind' | 'planned_shift' | 'planned_hours' | 'note'
  >,
  input: Pick<
    DailyShiftCorrectionInput,
    'plannedShift' | 'plannedHours' | 'note'
  >,
): boolean {
  return (
    existing.status === 'ACTIVE' &&
    existing.kind === scheduleCorrectionKindForShift(input.plannedShift) &&
    existing.planned_shift === input.plannedShift &&
    existing.planned_hours === input.plannedHours &&
    existing.note === input.note
  );
}

export async function saveDailyShiftCorrection(
  monthId: MonthId,
  input: DailyShiftCorrectionInput,
  currentCorrection: ScheduleCorrection | null,
): Promise<void> {
  assertCorrection(monthId, input);
  if (
    currentCorrection &&
    (currentCorrection.monthId !== monthId ||
      currentCorrection.employeeId !== input.employeeId ||
      currentCorrection.tetaNumber !== input.tetaNumber ||
      currentCorrection.date !== input.date ||
      currentCorrection.status !== 'ACTIVE')
  ) {
    throw new ScheduleCorrectionServiceError('invalid-correction');
  }
  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new ScheduleCorrectionServiceError('firebase-unavailable');
  }

  const actorUid = await requireActorUid();
  const corrections = repositories.forMonth(monthId).scheduleCorrections;
  const reference = currentCorrection
    ? doc(corrections, currentCorrection.id)
    : doc(
        corrections,
        scheduleCorrectionDocumentId(input.employeeId, input.date),
      );
  const auditReference = doc(repositories.auditLog);
  const kind = scheduleCorrectionKindForShift(input.plannedShift);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists() ? snapshot.data() : null;
    if (currentCorrection && !existing) {
      throw new ScheduleCorrectionServiceError('invalid-correction');
    }
    if (
      existing &&
      (existing.employee_id !== input.employeeId ||
        existing.teta_number !== input.tetaNumber ||
        existing.date !== input.date)
    ) {
      throw new ScheduleCorrectionServiceError('invalid-correction');
    }
    if (existing && isDailyShiftCorrectionUnchanged(existing, input)) {
      return;
    }

    if (existing) {
      if (!['ACTIVE', 'CANCELLED'].includes(existing.status)) {
        throw new ScheduleCorrectionServiceError('invalid-correction');
      }
      transaction.update(reference, {
        kind,
        planned_shift: input.plannedShift,
        planned_hours: input.plannedHours,
        note: input.note,
        status: 'ACTIVE',
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
    } else {
      transaction.set(reference, {
        employee_id: input.employeeId,
        teta_number: input.tetaNumber,
        date: input.date,
        kind,
        planned_shift: input.plannedShift,
        planned_hours: input.plannedHours,
        note: input.note,
        status: 'ACTIVE',
        created_at: serverTimestamp(),
        created_by: actorUid,
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      });
    }

    transaction.set(auditReference, {
      entity_path: reference.path,
      action: existing ? 'update' : 'create',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        change_kind: 'daily-planned-shift-correction',
        employee_id: input.employeeId,
        teta_number: input.tetaNumber,
        date: input.date,
        previous_shift: existing?.planned_shift ?? null,
        new_shift: input.plannedShift,
        planned_hours: input.plannedHours,
        note: input.note,
      },
    });
  });
}

export async function cancelDailyShiftCorrection(
  monthId: MonthId,
  correction: ScheduleCorrection,
): Promise<void> {
  if (
    correction.monthId !== monthId ||
    correction.status !== 'ACTIVE' ||
    !correction.date.startsWith(`${monthId}-`)
  ) {
    throw new ScheduleCorrectionServiceError('invalid-correction');
  }

  const firestore = getFirestoreClient();
  const repositories = getFirestoreRepositories();
  if (!firestore || !repositories) {
    throw new ScheduleCorrectionServiceError('firebase-unavailable');
  }

  const actorUid = await requireActorUid();
  const reference = doc(
    repositories.forMonth(monthId).scheduleCorrections,
    correction.id,
  );
  const auditReference = doc(repositories.auditLog);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) {
      throw new ScheduleCorrectionServiceError('invalid-correction');
    }
    if (snapshot.data().status === 'CANCELLED') return;
    if (snapshot.data().status !== 'ACTIVE') {
      throw new ScheduleCorrectionServiceError('invalid-correction');
    }
    transaction.update(reference, {
      status: 'CANCELLED',
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
    transaction.set(auditReference, {
      entity_path: reference.path,
      action: 'update',
      actor_uid: actorUid,
      occurred_at: serverTimestamp(),
      changes: {
        change_kind: 'daily-planned-shift-reset',
        employee_id: correction.employeeId,
        teta_number: correction.tetaNumber,
        date: correction.date,
        previous_shift: correction.plannedShift,
        new_shift: null,
      },
    });
  });
}

async function requireActorUid(): Promise<string> {
  if (!auth) {
    throw new ScheduleCorrectionServiceError('firebase-unavailable');
  }
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new ScheduleCorrectionServiceError('authentication-required');
  }
  return uid;
}

function assertCorrection(monthId: MonthId, input: DailyShiftCorrectionInput) {
  if (
    !input.date.startsWith(`${monthId}-`) ||
    !Number.isFinite(input.plannedHours) ||
    input.plannedHours <= 0 ||
    input.plannedHours > 24
  ) {
    throw new ScheduleCorrectionServiceError('invalid-correction');
  }
}
