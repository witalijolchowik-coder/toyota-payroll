import {
  Timestamp,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
  EmployeeAssignment,
  EmployeeAssignmentCreateInput,
  IsoDate,
} from '../types/firestore';
import {
  mapEmployeeAssignmentDocument,
  mapEmployeeDocument,
} from './firestore/mappers';
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

function dateToIsoDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

function previousIsoDate(value: IsoDate): IsoDate {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return dateToIsoDate(date);
}

function assignmentEffectiveDate(input: EmployeeCreateInput): IsoDate {
  if (input.assignmentEffectiveDate) {
    return input.assignmentEffectiveDate;
  }
  if (input.employmentStartDate) {
    return dateToIsoDate(input.employmentStartDate);
  }
  return dateToIsoDate(new Date());
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
    pesel: normalized.pesel,
    passport_number: normalized.passportNumber,
    foreign_document_number: normalized.foreignDocumentNumber,
    is_active: true,
    department_id: normalized.departmentId,
    shift_assignment: normalized.shiftAssignment,
    employment_start_date: timestampOrNull(normalized.employmentStartDate),
    employment_end_date: timestampOrNull(normalized.employmentEndDate),
    created_at: serverTimestamp(),
    created_by: actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  await createEmployeeAssignment({
    employeeId: employee.id,
    tetaNumber: normalized.tetaNumber,
    departmentId: normalized.departmentId,
    shiftAssignment: normalized.shiftAssignment,
    validFrom: assignmentEffectiveDate(normalized),
    validTo: null,
    note: null,
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
  const previousEmployeeSnapshot = await getDoc(
    repositories.employee(employeeId),
  );
  const previousEmployee = previousEmployeeSnapshot.exists()
    ? mapEmployeeDocument(employeeId, previousEmployeeSnapshot.data())
    : null;

  await updateDoc(repositories.employee(employeeId), {
    teta_number: normalized.tetaNumber,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    pesel: normalized.pesel,
    passport_number: normalized.passportNumber,
    foreign_document_number: normalized.foreignDocumentNumber,
    department_id: normalized.departmentId,
    shift_assignment: normalized.shiftAssignment,
    employment_start_date: timestampOrNull(normalized.employmentStartDate),
    employment_end_date: timestampOrNull(normalized.employmentEndDate),
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  if (
    previousEmployee &&
    (previousEmployee.departmentId !== normalized.departmentId ||
      previousEmployee.shiftAssignment !== normalized.shiftAssignment)
  ) {
    await replaceCurrentEmployeeAssignment({
      employeeId,
      tetaNumber: normalized.tetaNumber,
      departmentId: normalized.departmentId,
      shiftAssignment: normalized.shiftAssignment,
      validFrom: assignmentEffectiveDate(normalized),
      validTo: null,
      note: null,
    });
  }
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

async function createEmployeeAssignment(
  input: EmployeeAssignmentCreateInput,
): Promise<void> {
  const actorUid = requireActorUid();
  const repositories = requireRepositories();

  await addDoc(repositories.employeeAssignments, {
    employee_id: input.employeeId,
    teta_number: input.tetaNumber,
    department_id: input.departmentId,
    shift_assignment: input.shiftAssignment,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    status: 'ACTIVE',
    note: input.note,
    created_at: serverTimestamp(),
    created_by: actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });
}

async function replaceCurrentEmployeeAssignment(
  input: EmployeeAssignmentCreateInput,
): Promise<void> {
  const actorUid = requireActorUid();
  const repositories = requireRepositories();
  const snapshot = await getDocs(
    query(
      repositories.employeeAssignments,
      where('employee_id', '==', input.employeeId),
      where('status', '==', 'ACTIVE'),
    ),
  );
  const assignments = snapshot.docs.map((document) =>
    mapEmployeeAssignmentDocument(document.id, document.data()),
  );
  const previousDay = previousIsoDate(input.validFrom);
  const overlappingAssignments = assignments.filter((assignment) =>
    overlapsAssignment(assignment, input.validFrom),
  );

  await Promise.all(
    overlappingAssignments.map((assignment) =>
      updateDoc(repositories.employeeAssignment(assignment.id), {
        valid_to:
          assignment.validFrom < input.validFrom
            ? previousDay
            : assignment.validTo,
        status: assignment.validFrom < input.validFrom ? 'ACTIVE' : 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: actorUid,
      }),
    ),
  );

  await createEmployeeAssignment(input);
}

function overlapsAssignment(
  assignment: EmployeeAssignment,
  validFrom: IsoDate,
): boolean {
  return (
    assignment.validFrom <= validFrom &&
    (!assignment.validTo || assignment.validTo >= validFrom)
  );
}
