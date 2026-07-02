import {
  Timestamp,
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../config/firebase';
import {
  isTetaNumberUniqueAmongActiveEmployees,
  normalizeEmployeeInput,
} from '../features/employees/employeeValidation';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeId,
} from '../types/firestore';
import { mapEmployeeDocument } from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';

export type EmployeeServiceErrorCode =
  'firebase-unavailable' | 'authentication-required' | 'duplicate-teta';

export class EmployeeServiceError extends Error {
  constructor(readonly code: EmployeeServiceErrorCode) {
    super(code);
    this.name = 'EmployeeServiceError';
  }
}

function requireRepositories() {
  const repositories = getFirestoreRepositories();
  if (!repositories) {
    throw new EmployeeServiceError('firebase-unavailable');
  }
  return repositories;
}

function requireActorUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new EmployeeServiceError('authentication-required');
  }
  return uid;
}

function timestampOrNull(value: Date | null) {
  return value ? Timestamp.fromDate(value) : null;
}

async function getEmployeesForUniquenessCheck(): Promise<Employee[]> {
  const repositories = requireRepositories();
  const snapshot = await getDocs(repositories.employees);
  return snapshot.docs.map((document) =>
    mapEmployeeDocument(document.id, document.data()),
  );
}

async function assertUniqueActiveTeta(
  input: EmployeeCreateInput,
  ignoredEmployeeId?: EmployeeId,
) {
  if (!input.isActive) {
    return;
  }

  const employees = await getEmployeesForUniquenessCheck();
  if (
    !isTetaNumberUniqueAmongActiveEmployees(
      employees,
      input.tetaNumber,
      ignoredEmployeeId,
    )
  ) {
    throw new EmployeeServiceError('duplicate-teta');
  }
}

export function subscribeToEmployees(
  onEmployees: (employees: Employee[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  try {
    const repositories = requireRepositories();
    if (!auth) {
      throw new EmployeeServiceError('firebase-unavailable');
    }

    const employeesQuery = query(
      repositories.employees,
      orderBy('teta_number'),
    );
    let unsubscribeSnapshot: Unsubscribe = () => undefined;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribeSnapshot();
        if (!user) {
          onError(new EmployeeServiceError('authentication-required'));
          return;
        }

        unsubscribeSnapshot = onSnapshot(
          employeesQuery,
          (snapshot) => {
            onEmployees(
              snapshot.docs.map((document) =>
                mapEmployeeDocument(document.id, document.data()),
              ),
            );
          },
          onError,
        );
      },
      onError,
    );

    return () => {
      unsubscribeSnapshot();
      unsubscribeAuth();
    };
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => undefined;
  }
}

export async function createEmployee(
  input: EmployeeCreateInput,
): Promise<EmployeeId> {
  const actorUid = requireActorUid();
  const repositories = requireRepositories();
  const normalized = normalizeEmployeeInput(input);

  await assertUniqueActiveTeta(normalized);

  const employee = await addDoc(repositories.employees, {
    teta_number: normalized.tetaNumber,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    is_active: true,
    employment_start_date: timestampOrNull(normalized.employmentStartDate),
    employment_end_date: timestampOrNull(normalized.employmentEndDate),
    created_at: serverTimestamp(),
    created_by: actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  return employee.id;
}

export async function updateEmployee(
  employeeId: EmployeeId,
  input: EmployeeCreateInput,
): Promise<void> {
  const actorUid = requireActorUid();
  const repositories = requireRepositories();
  const normalized = normalizeEmployeeInput(input);

  await assertUniqueActiveTeta(normalized, employeeId);

  await updateDoc(repositories.employee(employeeId), {
    teta_number: normalized.tetaNumber,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    employment_start_date: timestampOrNull(normalized.employmentStartDate),
    employment_end_date: timestampOrNull(normalized.employmentEndDate),
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });
}

export async function deactivateEmployee(
  employeeId: EmployeeId,
): Promise<void> {
  const actorUid = requireActorUid();
  const repositories = requireRepositories();

  await updateDoc(repositories.employee(employeeId), {
    is_active: false,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });
}
