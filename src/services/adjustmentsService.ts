import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import {
  normalizeAdjustmentInput,
  validateAdjustmentInput,
} from '../features/adjustments/adjustmentValidation';
import type {
  Adjustment,
  AdjustmentCreateInput,
  AdjustmentUpdateInput,
  Employee,
  MonthId,
  PayrollMonth,
} from '../types/firestore';
import {
  mapAdjustmentDocument,
  mapEmployeeDocument,
  mapMonthDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type AdjustmentsServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'month-unavailable'
  | 'month-settled'
  | 'read-only-record';

export class AdjustmentsServiceError extends Error {
  constructor(readonly code: AdjustmentsServiceErrorCode) {
    super(code);
    this.name = 'AdjustmentsServiceError';
  }
}

export interface AdjustmentWorkspaceData {
  month: PayrollMonth | null;
  employees: Employee[];
  adjustments: Adjustment[];
}

function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new AdjustmentsServiceError('firebase-unavailable');
  }
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new AdjustmentsServiceError('authentication-required');
  }
  return { repositories, uid };
}

async function requireWritableMonth(monthId: MonthId): Promise<PayrollMonth> {
  const { repositories } = requireContext();
  const snapshot = await getDoc(repositories.forMonth(monthId).month);
  if (!snapshot.exists()) {
    throw new AdjustmentsServiceError('month-unavailable');
  }
  const month = mapMonthDocument(monthId, snapshot.data());
  if (month.isSettled) {
    throw new AdjustmentsServiceError('month-settled');
  }
  return month;
}

export async function loadAdjustmentWorkspace(
  monthId: MonthId,
): Promise<AdjustmentWorkspaceData> {
  const { repositories } = requireContext();
  const monthRepository = repositories.forMonth(monthId);
  const [monthSnapshot, employeesSnapshot, adjustmentsSnapshot] =
    await Promise.all([
      getDoc(monthRepository.month),
      getDocs(query(repositories.employees, orderBy('teta_number'))),
      getDocs(monthRepository.adjustments),
    ]);

  return {
    month: monthSnapshot.exists()
      ? mapMonthDocument(monthId, monthSnapshot.data())
      : null,
    employees: employeesSnapshot.docs.map((document) =>
      mapEmployeeDocument(document.id, document.data()),
    ),
    adjustments: adjustmentsSnapshot.docs.map((document) =>
      mapAdjustmentDocument(document.id, monthId, document.data()),
    ),
  };
}

export async function createEmployeeAdjustment(
  monthId: MonthId,
  input: AdjustmentCreateInput,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const normalized = normalizeAdjustmentInput(input);
  if (Object.keys(validateAdjustmentInput(normalized)).length > 0) {
    throw new AdjustmentsServiceError('invalid-input');
  }
  await requireWritableMonth(monthId);

  const reference = await addDoc(repositories.forMonth(monthId).adjustments, {
    employee_id: normalized.employeeId,
    teta_number: normalized.tetaNumber,
    category: normalized.category,
    direction: normalized.direction,
    amount: normalized.amount,
    note: normalized.note,
    status: 'ACTIVE',
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  return reference.id;
}

export async function updateEmployeeAdjustment(
  adjustment: Adjustment,
  input: AdjustmentUpdateInput,
): Promise<void> {
  if (adjustment.status !== 'ACTIVE') {
    throw new AdjustmentsServiceError('read-only-record');
  }
  const { repositories, uid } = requireContext();
  const normalized = normalizeAdjustmentInput(input);
  const completeInput: AdjustmentCreateInput = {
    employeeId: adjustment.employeeId,
    tetaNumber: adjustment.tetaNumber,
    ...normalized,
  };
  if (Object.keys(validateAdjustmentInput(completeInput)).length > 0) {
    throw new AdjustmentsServiceError('invalid-input');
  }
  await requireWritableMonth(adjustment.monthId);

  await updateDoc(
    doc(repositories.forMonth(adjustment.monthId).adjustments, adjustment.id),
    {
      category: normalized.category,
      direction: normalized.direction,
      amount: normalized.amount,
      note: normalized.note,
      updated_at: serverTimestamp(),
      updated_by: uid,
    },
  );
}

export async function cancelEmployeeAdjustment(
  adjustment: Adjustment,
): Promise<void> {
  if (adjustment.status !== 'ACTIVE') {
    throw new AdjustmentsServiceError('read-only-record');
  }
  const { repositories, uid } = requireContext();
  await requireWritableMonth(adjustment.monthId);
  await updateDoc(
    doc(repositories.forMonth(adjustment.monthId).adjustments, adjustment.id),
    {
      status: 'CANCELLED',
      updated_at: serverTimestamp(),
      updated_by: uid,
    },
  );
}
