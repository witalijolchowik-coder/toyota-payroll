import {
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { auth } from '../config/firebase';
import type {
  Department,
  DepartmentCreateInput,
  DepartmentUpdateInput,
} from '../types/firestore';
import {
  departmentKeyFromName,
  isDepartmentShiftMode,
  isValidDepartmentName,
  normalizeDepartmentName,
} from '../utils/organization';
import { mapDepartmentDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type DepartmentsServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'invalid-input';

export class DepartmentsServiceError extends Error {
  constructor(readonly code: DepartmentsServiceErrorCode) {
    super(code);
    this.name = 'DepartmentsServiceError';
  }
}

function requireContext() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new DepartmentsServiceError('firebase-unavailable');
  }
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new DepartmentsServiceError('authentication-required');
  }
  return { repositories, uid };
}

export function normalizeDepartmentInput(
  input: DepartmentCreateInput,
): DepartmentCreateInput {
  const name = normalizeDepartmentName(input.name);
  return {
    ...input,
    id: input.id.trim() || departmentKeyFromName(name),
    name,
  };
}

export function validateDepartmentInput(
  input: DepartmentCreateInput | DepartmentUpdateInput,
): boolean {
  return (
    isValidDepartmentName(input.name) && isDepartmentShiftMode(input.shiftMode)
  );
}

export async function loadDepartments(): Promise<Department[]> {
  const { repositories } = requireContext();
  const snapshot = await getDocs(
    query(repositories.departments, orderBy('name')),
  );
  return snapshot.docs.map((document) =>
    mapDepartmentDocument(document.id, document.data()),
  );
}

export async function createDepartment(
  input: DepartmentCreateInput,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const normalized = normalizeDepartmentInput(input);
  if (!validateDepartmentInput(normalized) || !normalized.id) {
    throw new DepartmentsServiceError('invalid-input');
  }

  await setDoc(doc(repositories.departments, normalized.id), {
    name: normalized.name,
    shift_mode: normalized.shiftMode,
    active: normalized.active,
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
  return normalized.id;
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentUpdateInput,
): Promise<void> {
  const { repositories, uid } = requireContext();
  const normalized = {
    ...input,
    name: normalizeDepartmentName(input.name),
  };
  if (!validateDepartmentInput(normalized)) {
    throw new DepartmentsServiceError('invalid-input');
  }

  await updateDoc(doc(repositories.departments, departmentId), {
    name: normalized.name,
    shift_mode: normalized.shiftMode,
    active: normalized.active,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
}
