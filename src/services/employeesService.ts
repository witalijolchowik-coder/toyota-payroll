import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
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
  mapEmployeeContractDocument,
  mapEmployeeDocument,
  mapEmploymentEndEventDocument,
} from './firestore/mappers';
import { getFirestoreRepositories } from './firestoreService';
import { appendAuditEntryToBatch, recordAuditEntry } from './auditService';
import { preserveFirstToyotaEmploymentDate } from '../utils/payroll';
import { bootstrapLegacyEmployeeContract } from './employeeContractsService';

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
  if (input.initialContract) {
    return dateToIsoDate(input.initialContract.startDate);
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
  if (!input.tetaNumber.trim()) {
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
    let unsubscribeEmployees: Unsubscribe = () => undefined;
    let unsubscribeContracts: Unsubscribe = () => undefined;
    let unsubscribeEnds: Unsubscribe = () => undefined;
    let employeeDocuments: Employee[] = [];
    let contracts = [] as ReturnType<typeof mapEmployeeContractDocument>[];
    let endEvents = [] as ReturnType<typeof mapEmploymentEndEventDocument>[];
    let employeesLoaded = false;
    let contractsLoaded = false;
    let endsLoaded = false;
    const migrationsStarted = new Set<string>();

    const emit = () => {
      const hydrated = employeeDocuments.map((employee) => ({
        ...employee,
        contracts: contracts.filter(
          (contract) => contract.employeeId === employee.id,
        ),
        employmentEndEvents: endEvents.filter(
          (event) => event.employeeId === employee.id,
        ),
      }));
      onEmployees(hydrated);
      if (employeesLoaded && contractsLoaded && endsLoaded) {
        hydrated
          .filter(
            (employee) =>
              !migrationsStarted.has(employee.id) &&
              (employee.contracts?.length ?? 0) === 0 &&
              Boolean(employee.employmentStartDate),
          )
          .forEach((employee) => {
            migrationsStarted.add(employee.id);
            void bootstrapLegacyEmployeeContract(employee).catch((error) => {
              migrationsStarted.delete(employee.id);
              console.error('Legacy contract migration failed', error);
            });
          });
      }
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribeEmployees();
        unsubscribeContracts();
        unsubscribeEnds();
        if (!user) {
          onError(new EmployeeServiceError('authentication-required'));
          return;
        }

        unsubscribeEmployees = onSnapshot(
          employeesQuery,
          (snapshot) => {
            employeesLoaded = true;
            employeeDocuments = snapshot.docs.map((document) =>
              mapEmployeeDocument(document.id, document.data()),
            );
            emit();
          },
          onError,
        );
        unsubscribeContracts = onSnapshot(
          repositories.employeeContracts,
          (snapshot) => {
            contractsLoaded = true;
            contracts = snapshot.docs.map((document) =>
              mapEmployeeContractDocument(document.id, document.data()),
            );
            emit();
          },
          onError,
        );
        unsubscribeEnds = onSnapshot(
          repositories.employmentEndEvents,
          (snapshot) => {
            endsLoaded = true;
            endEvents = snapshot.docs.map((document) =>
              mapEmploymentEndEventDocument(document.id, document.data()),
            );
            emit();
          },
          onError,
        );
      },
      onError,
    );

    return () => {
      unsubscribeEmployees();
      unsubscribeContracts();
      unsubscribeEnds();
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

  const employee = doc(repositories.employees);
  const contract = normalized.initialContract
    ? doc(repositories.employeeContracts)
    : null;
  const assignment = doc(repositories.employeeAssignments);
  const batch = writeBatch(repositories.employees.firestore);
  batch.set(employee, {
    teta_number: normalized.tetaNumber,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    pesel: normalized.pesel,
    passport_number: normalized.passportNumber,
    foreign_document_number: normalized.foreignDocumentNumber,
    phone_number: normalized.phoneNumber ?? null,
    citizenship: normalized.citizenship ?? null,
    gender: normalized.gender ?? null,
    first_toyota_employment_date: timestampOrNull(
      normalized.firstToyotaEmploymentDate ?? null,
    ),
    medical_examination_date: timestampOrNull(
      normalized.medicalExaminationDate ?? null,
    ),
    medical_valid_until: timestampOrNull(normalized.medicalValidUntil ?? null),
    medical_examination_type: normalized.medicalExaminationType ?? null,
    is_active: true,
    department_id: normalized.departmentId,
    shift_assignment: normalized.shiftAssignment,
    // Deprecated compatibility snapshot. New business logic reads the
    // employeeContracts collection exclusively.
    employment_start_date: timestampOrNull(
      normalized.initialContract?.startDate ?? null,
    ),
    employment_end_date: timestampOrNull(
      normalized.initialContract?.endDate ?? null,
    ),
    created_at: serverTimestamp(),
    created_by: actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  if (contract && normalized.initialContract) {
    batch.set(contract, {
      employee_id: employee.id,
      teta_number: normalized.tetaNumber,
      sequence_id: `initial-${employee.id}`,
      start_date: dateToIsoDate(normalized.initialContract.startDate),
      end_date: normalized.initialContract.endDate
        ? dateToIsoDate(normalized.initialContract.endDate)
        : null,
      status: 'ACTIVE',
      note: null,
      created_at: serverTimestamp(),
      created_by: actorUid,
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
  }

  batch.set(assignment, {
    employee_id: employee.id,
    teta_number: normalized.tetaNumber,
    department_id: normalized.departmentId,
    shift_assignment: normalized.shiftAssignment,
    valid_from: assignmentEffectiveDate(normalized),
    valid_to: null,
    status: 'ACTIVE',
    note: null,
    created_at: serverTimestamp(),
    created_by: actorUid,
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employees/${employee.id}`,
    action: 'create',
    actorUid,
    changes: {
      operation: 'employee-created',
      initial_contract_start_date:
        normalized.initialContract?.startDate.toISOString() ?? null,
      first_toyota_employment_date:
        normalized.firstToyotaEmploymentDate?.toISOString() ?? null,
      department_id: normalized.departmentId,
      shift_assignment: normalized.shiftAssignment,
    },
  });
  await batch.commit();

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
  const stableFirstToyotaEmploymentDate = preserveFirstToyotaEmploymentDate(
    previousEmployee?.firstToyotaEmploymentDate,
    normalized.firstToyotaEmploymentDate,
  );

  const batch = writeBatch(repositories.employees.firestore);
  batch.update(repositories.employee(employeeId), {
    teta_number: normalized.tetaNumber,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    pesel: normalized.pesel,
    passport_number: normalized.passportNumber,
    foreign_document_number: normalized.foreignDocumentNumber,
    phone_number: normalized.phoneNumber ?? null,
    citizenship: normalized.citizenship ?? null,
    gender: normalized.gender ?? null,
    first_toyota_employment_date: timestampOrNull(
      stableFirstToyotaEmploymentDate,
    ),
    medical_examination_date: timestampOrNull(
      normalized.medicalExaminationDate ?? null,
    ),
    medical_valid_until: timestampOrNull(normalized.medicalValidUntil ?? null),
    medical_examination_type: normalized.medicalExaminationType ?? null,
    department_id: normalized.departmentId,
    shift_assignment: normalized.shiftAssignment,
    // Contract dates are managed in employeeContracts. Legacy fields are a
    // derived compatibility snapshot and are not overwritten by profile edits.
    updated_at: serverTimestamp(),
    updated_by: actorUid,
  });

  const assignmentChanged =
    previousEmployee &&
    (previousEmployee.departmentId !== normalized.departmentId ||
      previousEmployee.shiftAssignment !== normalized.shiftAssignment);
  if (assignmentChanged) {
    await appendEmployeeAssignmentReplacementToBatch(batch, {
      employeeId,
      tetaNumber: normalized.tetaNumber,
      departmentId: normalized.departmentId,
      shiftAssignment: normalized.shiftAssignment,
      validFrom: assignmentEffectiveDate(normalized),
      validTo: null,
      note: null,
    });
  }

  appendAuditEntryToBatch(batch, repositories, {
    entityPath: `employees/${employeeId}`,
    action: 'update',
    actorUid,
    changes: {
      operation: 'employee-updated',
      before: previousEmployee
        ? {
            teta_number: previousEmployee.tetaNumber,
            first_toyota_employment_date:
              previousEmployee.firstToyotaEmploymentDate?.toISOString() ?? null,
            phone_number: previousEmployee.phoneNumber ?? null,
            citizenship: previousEmployee.citizenship ?? null,
            gender: previousEmployee.gender ?? null,
            medical_examination_date:
              previousEmployee.medicalExaminationDate?.toISOString() ?? null,
            medical_valid_until:
              previousEmployee.medicalValidUntil?.toISOString() ?? null,
            medical_examination_type:
              previousEmployee.medicalExaminationType ?? null,
            department_id: previousEmployee.departmentId,
            shift_assignment: previousEmployee.shiftAssignment,
          }
        : null,
      after: {
        teta_number: normalized.tetaNumber,
        first_toyota_employment_date:
          stableFirstToyotaEmploymentDate?.toISOString() ?? null,
        phone_number: normalized.phoneNumber ?? null,
        citizenship: normalized.citizenship ?? null,
        gender: normalized.gender ?? null,
        medical_examination_date:
          normalized.medicalExaminationDate?.toISOString() ?? null,
        medical_valid_until:
          normalized.medicalValidUntil?.toISOString() ?? null,
        medical_examination_type: normalized.medicalExaminationType ?? null,
        department_id: normalized.departmentId,
        shift_assignment: normalized.shiftAssignment,
      },
    },
  });
  await batch.commit();
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
  await recordAuditEntry({
    entityPath: `employees/${employeeId}`,
    action: 'update',
    actorUid,
    changes: { operation: 'employee-deactivated', is_active: false },
  });
}

async function appendEmployeeAssignmentReplacementToBatch(
  batch: ReturnType<typeof writeBatch>,
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

  overlappingAssignments.forEach((assignment) => {
    batch.update(repositories.employeeAssignment(assignment.id), {
      valid_to:
        assignment.validFrom < input.validFrom
          ? previousDay
          : assignment.validTo,
      status: assignment.validFrom < input.validFrom ? 'ACTIVE' : 'CANCELLED',
      updated_at: serverTimestamp(),
      updated_by: actorUid,
    });
  });

  batch.set(doc(repositories.employeeAssignments), {
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

function overlapsAssignment(
  assignment: EmployeeAssignment,
  validFrom: IsoDate,
): boolean {
  return (
    assignment.validFrom <= validFrom &&
    (!assignment.validTo || assignment.validTo >= validFrom)
  );
}
