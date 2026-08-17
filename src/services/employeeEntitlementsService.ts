import {
  addDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  EmployeeEntitlementUpdateInput,
} from '../types/firestore';
import { mapEmployeeEntitlementDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { recordAuditEntry } from './auditService';

export type EmployeeEntitlementServiceErrorCode =
  | 'firebase-unavailable'
  | 'authentication-required'
  | 'invalid-input'
  | 'locked-month';

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
  await recordAuditEntry({
    entityPath: `employeeEntitlements/${reference.id}`,
    action: 'create',
    actorUid: uid,
    changes: {
      operation:
        normalized.type === 'COMPANY_ACCOMMODATION'
          ? 'accommodation-move-in'
          : 'entitlement-created',
      employee_id: normalized.employeeId,
      type: normalized.type,
      valid_from: normalized.validFrom,
      valid_to: normalized.validTo,
      accommodation_variant_key: normalized.accommodationVariantKey,
    },
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
  await recordAuditEntry({
    entityPath: `employeeEntitlements/${entitlementId}`,
    action: 'update',
    actorUid: uid,
    changes: {
      operation: validTo
        ? 'accommodation-or-entitlement-ended'
        : 'entitlement-updated',
      valid_to: validTo,
      note,
    },
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
  await recordAuditEntry({
    entityPath: `employeeEntitlements/${entitlementId}`,
    action: 'update',
    actorUid: uid,
    changes: { operation: 'entitlement-cancelled', status: 'CANCELLED' },
  });
}

function previousIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function transitionEmployeeHousing({
  employeeId,
  tetaNumber,
  effectiveDate,
  target,
  accommodationVariantKey = null,
}: {
  employeeId: string;
  tetaNumber: string;
  effectiveDate: string;
  target: 'OWN_HOUSING_ALLOWANCE' | 'COMPANY_ACCOMMODATION';
  accommodationVariantKey?: string | null;
}): Promise<string> {
  const { repositories, uid } = await requireContext();
  const normalized = normalizeInput({
    employeeId,
    tetaNumber,
    type: target,
    accommodationVariantKey,
    validFrom: effectiveDate,
    validTo: null,
    note: null,
  });
  const [entitlementsSnapshot, monthsSnapshot] = await Promise.all([
    getDocs(repositories.employeeEntitlements),
    getDocs(repositories.months),
  ]);
  const employeeHousing = entitlementsSnapshot.docs.filter((snapshot) => {
    const data = snapshot.data();
    return (
      data.employee_id === normalized.employeeId &&
      data.status === 'ACTIVE' &&
      (data.type === 'OWN_HOUSING_ALLOWANCE' ||
        data.type === 'COMPANY_ACCOMMODATION')
    );
  });
  const companyAccommodation = employeeHousing.filter(
    (snapshot) => snapshot.data().type === 'COMPANY_ACCOMMODATION',
  );
  const currentCompanyAccommodation = companyAccommodation.filter(
    (snapshot) => {
      const data = snapshot.data();
      return (
        data.valid_from < normalized.validFrom &&
        (data.valid_to === null || data.valid_to >= normalized.validFrom)
      );
    },
  );
  const currentLegacyOwnHousing = employeeHousing.filter((snapshot) => {
    const data = snapshot.data();
    return (
      data.type === 'OWN_HOUSING_ALLOWANCE' &&
      data.valid_from <= normalized.validFrom &&
      (data.valid_to === null || data.valid_to >= normalized.validFrom)
    );
  });
  if (
    target === 'COMPANY_ACCOMMODATION' &&
    companyAccommodation.some((snapshot) => {
      const data = snapshot.data();
      return (
        data.valid_from >= normalized.validFrom ||
        (data.valid_from <= normalized.validFrom &&
          (data.valid_to === null || data.valid_to >= normalized.validFrom))
      );
    })
  ) {
    throw new EmployeeEntitlementServiceError('invalid-input');
  }
  if (
    target === 'OWN_HOUSING_ALLOWANCE' &&
    currentCompanyAccommodation.length !== 1
  ) {
    throw new EmployeeEntitlementServiceError('invalid-input');
  }
  const effectiveMonth = normalized.validFrom.slice(0, 7);
  if (
    monthsSnapshot.docs.some(
      (snapshot) => snapshot.id >= effectiveMonth && snapshot.data().is_settled,
    )
  ) {
    throw new EmployeeEntitlementServiceError('locked-month');
  }

  const batch = writeBatch(repositories.employeeEntitlements.firestore);
  const closedEntitlements =
    target === 'COMPANY_ACCOMMODATION'
      ? currentLegacyOwnHousing
      : currentCompanyAccommodation;
  closedEntitlements.forEach((snapshot) => {
    batch.update(snapshot.ref, {
      valid_to: previousIsoDate(normalized.validFrom),
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  });
  const newReference =
    target === 'COMPANY_ACCOMMODATION'
      ? doc(repositories.employeeEntitlements)
      : null;
  if (newReference) {
    batch.set(newReference, {
      employee_id: normalized.employeeId,
      teta_number: normalized.tetaNumber,
      type: normalized.type,
      accommodation_variant_key: normalized.accommodationVariantKey,
      valid_from: normalized.validFrom,
      valid_to: null,
      status: 'ACTIVE',
      note: null,
      created_at: serverTimestamp(),
      created_by: uid,
      updated_at: serverTimestamp(),
      updated_by: uid,
    });
  }
  await batch.commit();
  const resultId = newReference?.id ?? currentCompanyAccommodation[0]!.id;
  await recordAuditEntry({
    entityPath: `employeeEntitlements/${resultId}`,
    action: newReference ? 'create' : 'update',
    actorUid: uid,
    changes: {
      operation: 'housing-status-transition',
      employee_id: normalized.employeeId,
      effective_date: normalized.validFrom,
      target:
        target === 'COMPANY_ACCOMMODATION'
          ? 'COMPANY_ACCOMMODATION'
          : 'OWN_HOUSING_DEFAULT',
      closed_entitlement_ids: closedEntitlements.map((snapshot) => snapshot.id),
      accommodation_variant_key: normalized.accommodationVariantKey,
    },
  });
  return resultId;
}
