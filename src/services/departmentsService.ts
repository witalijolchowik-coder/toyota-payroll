import {
  doc,
  getDocs,
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
  CANONICAL_DEPARTMENTS,
  departmentKeyFromName,
  getCanonicalDepartmentDefinition,
  isDepartmentShiftMode,
  isValidDepartmentName,
  normalizeDepartmentName,
  resolveCanonicalDepartment,
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

export function canonicalDepartmentsFallback(): Department[] {
  const now = new Date(0);
  return CANONICAL_DEPARTMENTS.map((department) => ({
    id: department.id,
    name: department.name,
    shiftMode: department.shiftMode,
    active: true,
    rotationAnchorWeekStart: department.rotationAnchor.weekStartIsoDate,
    rotationBaseAssignment: department.rotationAnchor.baseAssignment,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  }));
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
  const canonical = resolveCanonicalDepartment(name);
  return {
    ...input,
    id:
      canonical.status === 'matched'
        ? canonical.department.id
        : input.id.trim() || departmentKeyFromName(name),
    name: canonical.status === 'matched' ? canonical.department.name : name,
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
  const context = requireContext();
  await ensureCanonicalDepartments(context).catch(() => undefined);

  let departments: Department[] = [];
  try {
    const snapshot = await getDocs(context.repositories.departments);
    departments = snapshot.docs
      .map((document) => mapDepartmentDocument(document.id, document.data()))
      .filter((department) => getCanonicalDepartmentDefinition(department.id));
  } catch {
    departments = [];
  }

  const byId = new Map(
    departments.map((department) => [department.id, department]),
  );
  return canonicalDepartmentsFallback().map(
    (fallback) => byId.get(fallback.id) ?? fallback,
  );
}

export async function createDepartment(
  input: DepartmentCreateInput,
): Promise<string> {
  const { repositories, uid } = requireContext();
  const normalized = normalizeDepartmentInput(input);
  const canonical = getCanonicalDepartmentDefinition(normalized.id);
  if (!validateDepartmentInput(normalized) || !normalized.id || !canonical) {
    throw new DepartmentsServiceError('invalid-input');
  }

  await setDoc(doc(repositories.departments, normalized.id), {
    name: canonical.name,
    shift_mode: canonical.shiftMode,
    active: normalized.active,
    rotation_anchor_week_start: canonical.rotationAnchor.weekStartIsoDate,
    rotation_base_assignment: canonical.rotationAnchor.baseAssignment,
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
  const canonical = getCanonicalDepartmentDefinition(departmentId);
  const normalized = {
    ...input,
    name: canonical?.name ?? normalizeDepartmentName(input.name),
  };
  if (!validateDepartmentInput(normalized) || !canonical) {
    throw new DepartmentsServiceError('invalid-input');
  }

  await updateDoc(doc(repositories.departments, departmentId), {
    name: canonical.name,
    shift_mode: normalized.shiftMode,
    active: normalized.active,
    rotation_anchor_week_start: canonical.rotationAnchor.weekStartIsoDate,
    rotation_base_assignment: canonical.rotationAnchor.baseAssignment,
    updated_at: serverTimestamp(),
    updated_by: uid,
  });
}

async function ensureCanonicalDepartments({
  repositories,
  uid,
}: ReturnType<typeof requireContext>): Promise<void> {
  const snapshot = await getDocs(repositories.departments);
  const existingIds = new Set(snapshot.docs.map((document) => document.id));

  await Promise.all(
    CANONICAL_DEPARTMENTS.map((department) => {
      const data = {
        name: department.name,
        shift_mode: department.shiftMode,
        active: true,
        rotation_anchor_week_start: department.rotationAnchor.weekStartIsoDate,
        rotation_base_assignment: department.rotationAnchor.baseAssignment,
        updated_at: serverTimestamp(),
        updated_by: uid,
        ...(existingIds.has(department.id)
          ? {}
          : {
              created_at: serverTimestamp(),
              created_by: uid,
            }),
      };

      return setDoc(doc(repositories.departments, department.id), data, {
        merge: true,
      });
    }),
  );
}
