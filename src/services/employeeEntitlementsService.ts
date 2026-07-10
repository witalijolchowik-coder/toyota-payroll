import {
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  EmployeeEntitlementUpdateInput,
} from '../types/firestore';
import { mapEmployeeEntitlementDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type EmployeeEntitlementServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'invalid-input';

export class EmployeeEntitlementServiceError extends Error {
  constructor(readonly code: EmployeeEntitlementServiceErrorCode) {
    super(code);
    this.name = 'EmployeeEntitlementServiceError';
  }
}

async function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new EmployeeEntitlementServiceError('firebase-unavailable');
  }
  if (!auth) {
    throw new EmployeeEntitlementServiceError('firebase-unavailable');
  }
  await auth.authStateReady();
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new EmployeeEntitlementServiceError('authentication-required');
  }
  return { repositories, uid };
}

function normalizeInput(
  input: EmployeeEntitlementCreateInput,
): EmployeeEntitlementCreateInput {
  const normalized = {
    ...input,
    tetaNumber: input.tetaNumber.trim(),
    accommodationVariantKey: input.accommodationVariantKey?.trim() || null,
    validFrom: input.validFrom.trim(),
    validTo: input.validTo?.trim() || null,
    note: input.note?.trim() || null,
  };

  if (
    !normalized.employeeId ||
    !normalized.tetaNumber ||
    !normalized.validFrom ||
    (normalized.validTo && normalized.validTo < normalized.validFrom)
  ) {
    throw new EmployeeEntitlementServiceError('invalid-input');
  }
  if (
    normalized.type === 'COMPANY_ACCOMMODATION' &&
    !normalized.accommodationVariantKey
  ) {
    throw new EmployeeEntitlementServiceError('invalid-input');
  }
  if (
    normalized.type !== 'COMPANY_ACCOMMODATION' &&
    normalized.accommodationVariantKey
  ) {
    return { ...normalized, accommodationVariantKey: null };
  }

  return normalized;
}

export async function loadEmployeeEntitlements(): Promise<
  EmployeeEntitlement[]
> {
  const { repositories } = await requireContext();
  const snapshot = await getDocs(
    query(repositories.employeeEntitlements, orderBy('employee_id')),
  );
  return snapshot.docs.map((document) =>
    mapEmployeeEntitlementDocument(document.id, document.data()),
  );
}

export async function createEmployeeEntitlement(
  input: EmployeeEntitlementCreateInput,
): Promise<string> {
  const { repositories, uid } = await requireContext();
  const normalized = normalizeInput(input);
  const reference = await addDoc(repositories.employeeEntitlements, {
    employee_id: normalized.employeeId,
    teta_number: normalized.tetaNumber,
    type: normalized.type,
    accommodation_variant_key: normalized.accommodationVariantKey,
    valid_from: normalized.validFrom,
    valid_to: normalized.validTo,
    status: 'ACTIVE',
    note: normalized.note,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  return reference.id;
}

export async function updateEmployeeEntitlement(
  entitlementId: string,
  input: EmployeeEntitlementUpdateInput,
): Promise<void> {
  const { repositories, uid } = await requireContext();
  const validTo = input.validTo?.trim() || null;
  const note = input.note?.trim() || null;
  await updateDoc(repositories.employeeEntitlement(entitlementId), {
    valid_to: validTo,
    note,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
}

export async function cancelEmployeeEntitlement(
  entitlementId: string,
): Promise<void> {
  const { repositories, uid } = await requireContext();
  await updateDoc(repositories.employeeEntitlement(entitlementId), {
    status: 'CANCELLED',
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
}
