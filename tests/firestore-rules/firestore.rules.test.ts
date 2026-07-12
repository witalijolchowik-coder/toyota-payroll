import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  collectionGroup,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const projectId = 'toyota-payroll-rules-test';
let testEnvironment: RulesTestEnvironment;

function modificationMetadata(uid: string) {
  return {
    created_at: serverTimestamp(),
    created_by: uid,
    updated_at: serverTimestamp(),
    updated_by: uid,
  };
}

async function seedMonth(monthId: string, isSettled: boolean) {
  const year = Number(monthId.slice(0, 4));
  const month = Number(monthId.slice(5, 7));
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'months', monthId), {
      year,
      month,
      month_start: new Date(Date.UTC(year, month - 1, 1)),
      month_end: new Date(Date.UTC(year, month, 1) - 1),
      is_settled: isSettled,
      calculation_version: 0,
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      created_by: 'system',
      updated_at: new Date('2026-07-01T00:00:00.000Z'),
      updated_by: 'system',
    });
  });
}

async function seedAppUser(
  uid: string,
  {
    active = true,
    role = 'coordinator',
    email = `${uid}@example.com`,
  }: { active?: boolean; role?: string; email?: string } = {},
) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'appUsers', uid), {
      email,
      role,
      active,
      display_name: uid,
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      updated_at: new Date('2026-07-01T00:00:00.000Z'),
    });
  });
}

async function seedEmployee(employeeId: string) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'employees', employeeId), {
      teta_number: 'TETA-1001',
      first_name: 'Jan',
      last_name: 'Kowalski',
      is_active: true,
      department_id: null,
      shift_assignment: null,
      employment_start_date: null,
      employment_end_date: null,
      created_at: new Date('2026-07-01T00:00:00.000Z'),
      created_by: 'system',
      updated_at: new Date('2026-07-01T00:00:00.000Z'),
      updated_by: 'system',
    });
  });
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedAppUser('coordinator-1');
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Firestore security rules', () => {
  it('denies public access', async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(firestore, 'employees', 'employee-1')));
    await assertFails(
      setDoc(doc(firestore, 'employees', 'public-write'), {
        teta_number: 'TETA-0001',
        first_name: 'Public',
        last_name: 'User',
        is_active: true,
        department_id: null,
        shift_assignment: null,
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata('anonymous'),
      }),
    );
  });

  it('denies authenticated users without an active app access record', async () => {
    await seedEmployee('employee-1');
    const unapproved = testEnvironment
      .authenticatedContext('unapproved-user')
      .firestore();

    await assertFails(getDoc(doc(unapproved, 'employees', 'employee-1')));
    await assertFails(
      setDoc(doc(unapproved, 'employees', 'employee-unapproved'), {
        teta_number: 'TETA-0002',
        first_name: 'No',
        last_name: 'Access',
        is_active: true,
        department_id: null,
        shift_assignment: null,
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata('unapproved-user'),
      }),
    );
  });

  it('denies inactive app users', async () => {
    await seedAppUser('inactive-user', { active: false });
    await seedEmployee('employee-1');
    const firestore = testEnvironment
      .authenticatedContext('inactive-user')
      .firestore();

    await assertFails(getDoc(doc(firestore, 'employees', 'employee-1')));
  });

  it('allows users to read only their own app access document', async () => {
    await seedAppUser('viewer-1', { role: 'viewer' });
    const firestore = testEnvironment
      .authenticatedContext('viewer-1')
      .firestore();

    await assertSucceeds(getDoc(doc(firestore, 'appUsers', 'viewer-1')));
    await assertFails(getDoc(doc(firestore, 'appUsers', 'coordinator-1')));
  });

  it('prevents users from approving or modifying their own app access', async () => {
    const unapproved = testEnvironment
      .authenticatedContext('new-user')
      .firestore();
    const approved = testEnvironment
      .authenticatedContext('coordinator-1')
      .firestore();

    await assertFails(
      setDoc(doc(unapproved, 'appUsers', 'new-user'), {
        email: 'new-user@example.com',
        role: 'admin',
        active: true,
        display_name: 'New User',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(approved, 'appUsers', 'coordinator-1'), {
        role: 'admin',
        updated_at: serverTimestamp(),
      }),
    );
  });

  it('allows a valid authenticated employee create', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertSucceeds(
      setDoc(doc(firestore, 'employees', 'employee-1'), {
        teta_number: 'TETA-1001',
        first_name: 'Test',
        last_name: 'Employee',
        pesel: '87010409887',
        passport_number: null,
        foreign_document_number: null,
        is_active: true,
        department_id: 'metal',
        shift_assignment: 'RED',
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows employee edits and deactivation but denies deletion', async () => {
    await seedEmployee('employee-1');
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const employee = doc(firestore, 'employees', 'employee-1');

    await assertSucceeds(
      updateDoc(employee, {
        first_name: 'Anna',
        pesel: '87010409887',
        passport_number: 'FU419350',
        foreign_document_number: null,
        department_id: 'szwalnia',
        shift_assignment: 'WHITE',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(employee, {
        is_active: false,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(employee));
  });

  it('rejects invalid employee fields and metadata actor spoofing', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(firestore, 'employees', 'employee-empty-teta'), {
        teta_number: '',
        first_name: 'Jan',
        last_name: 'Kowalski',
        is_active: true,
        department_id: null,
        shift_assignment: null,
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata(uid),
      }),
    );

    await assertFails(
      setDoc(doc(firestore, 'employees', 'employee-spoofed-actor'), {
        teta_number: 'TETA-2002',
        first_name: 'Anna',
        last_name: 'Nowak',
        is_active: true,
        department_id: null,
        shift_assignment: null,
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata('another-user'),
      }),
    );
  });

  it('allows employee entitlement create, period edit and cancellation but denies deletion', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const entitlement = doc(firestore, 'employeeEntitlements/udt-1');

    await assertSucceeds(
      setDoc(entitlement, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        type: 'UDT',
        accommodation_variant_key: null,
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(entitlement, {
        valid_to: '2026-12-31',
        note: 'Koniec uprawnienia',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(entitlement, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(entitlement));
  });

  it('rejects invalid employee entitlement shape and immutable identity updates', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const entitlement = doc(
      firestore,
      'employeeEntitlements/company-accommodation-1',
    );

    await assertFails(
      setDoc(entitlement, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        type: 'COMPANY_ACCOMMODATION',
        accommodation_variant_key: null,
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );

    await assertSucceeds(
      setDoc(entitlement, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        type: 'COMPANY_ACCOMMODATION',
        accommodation_variant_key: 'type-a',
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );

    await assertFails(
      updateDoc(entitlement, {
        type: 'OWN_HOUSING_ALLOWANCE',
        accommodation_variant_key: null,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
  });

  it('allows authenticated department create and safe edits but denies deletion', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const department = doc(firestore, 'departments/metal');

    await assertSucceeds(
      setDoc(department, {
        name: 'Metal',
        shift_mode: 'THREE_SHIFT',
        active: true,
        rotation_anchor_week_start: '2026-01-05',
        rotation_base_assignment: {
          RED: 'FIRST',
          WHITE: 'SECOND',
          BLUE: 'NIGHT',
        },
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(department, {
        name: 'Metal produkcja',
        active: false,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(department));
  });

  it('rejects invalid department shape and unauthenticated access', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const anonymous = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(anonymous, 'departments/metal')));
    await assertFails(
      setDoc(doc(firestore, 'departments/-invalid'), {
        name: 'Invalid',
        shift_mode: 'UNKNOWN',
        active: true,
        ...modificationMetadata(uid),
      }),
    );
    await assertFails(
      setDoc(doc(firestore, 'departments/metal'), {
        name: 'Metal',
        shift_mode: 'DAY_ONLY',
        active: true,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows employee assignment history create and safe closure', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const assignment = doc(firestore, 'employeeAssignments/assignment-1');

    await assertSucceeds(
      setDoc(assignment, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        department_id: 'metal',
        shift_assignment: 'RED',
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(assignment, {
        valid_to: '2026-06-14',
        note: 'Transfer od 2026-06-15',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(assignment, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(assignment));
  });

  it('rejects invalid employee assignment edits', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const assignment = doc(firestore, 'employeeAssignments/assignment-invalid');

    await assertFails(
      setDoc(assignment, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        department_id: 'metal',
        shift_assignment: 'GREEN',
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );

    await assertSucceeds(
      setDoc(assignment, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        department_id: 'metal',
        shift_assignment: 'RED',
        valid_from: '2026-06-01',
        valid_to: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
    await assertFails(
      updateDoc(assignment, {
        department_id: 'montaz',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
  });

  it('allows an authenticated user to create a canonical month document', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertSucceeds(
      setDoc(doc(firestore, 'months', '2026-07'), {
        year: 2026,
        month: 7,
        month_start: new Date('2026-07-01T00:00:00.000Z'),
        month_end: new Date('2026-07-31T23:59:59.999Z'),
        is_settled: false,
        calculation_version: 0,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('rejects month metadata that does not match the document ID', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(firestore, 'months', '2026-07'), {
        year: 2026,
        month: 6,
        month_start: new Date('2026-06-01T00:00:00.000Z'),
        month_end: new Date('2026-06-30T23:59:59.999Z'),
        is_settled: false,
        calculation_version: 0,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('denies child writes beneath a settled month', async () => {
    await seedMonth('2026-07', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const dailyValuePath = 'months/2026-07/dailyValues/employee-1_2026-07-02';

    await assertFails(
      setDoc(doc(firestore, dailyValuePath), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-02',
        hours: 6,
        source: 'manual',
        import_id: null,
        note: null,
        ...modificationMetadata(uid),
      }),
    );

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), dailyValuePath), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-02',
        hours: 6,
        source: 'manual',
        import_id: null,
        note: null,
        created_at: new Date('2026-07-01T00:00:00.000Z'),
        created_by: uid,
        updated_at: new Date('2026-07-01T00:00:00.000Z'),
        updated_by: uid,
      });
    });

    await assertFails(
      updateDoc(doc(firestore, dailyValuePath), {
        hours: 7,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(doc(firestore, dailyValuePath)));

    const importedPath = 'months/2026-07/dailyValues/employee-2_2026-07-02';
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), importedPath), {
        employee_id: 'employee-2',
        teta_number: 'TETA-1002',
        date: '2026-07-02',
        hours: 7,
        source: 'attendance_import',
        import_id: 'import-1',
        note: null,
        manual_override: null,
        created_at: new Date('2026-07-01T00:00:00.000Z'),
        created_by: 'system',
        updated_at: new Date('2026-07-01T00:00:00.000Z'),
        updated_by: 'system',
      });
    });
    await assertFails(
      updateDoc(doc(firestore, importedPath), {
        manual_override: {
          hours: 8,
          note: null,
          actor_uid: uid,
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
  });

  it('prevents a settled month from being reopened or modified', async () => {
    await seedMonth('2026-07', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      updateDoc(doc(firestore, 'months', '2026-07'), {
        is_settled: false,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
  });

  it('denies client writes to calculated settlement snapshots', async () => {
    await seedMonth('2026-07', false);
    const firestore = testEnvironment
      .authenticatedContext('coordinator-1')
      .firestore();

    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/employeeSettlements/employee-1'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        totals: {},
        warnings: [],
        calculated_at: serverTimestamp(),
        calculation_version: 'test',
      }),
    );
  });

  it('allows monthly review state create and update in an open month', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const reviewState = doc(
      firestore,
      'months/2026-07/reviewStates/employee-1',
    );

    await assertSucceeds(
      setDoc(reviewState, {
        month_id: '2026-07',
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        review_status: 'NEEDS_REVIEW',
        review_note: '',
        reviewed_at: serverTimestamp(),
        reviewed_by: uid,
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(reviewState, {
        review_status: 'CHECKED',
        review_note: 'Sprawdzone',
        reviewed_at: serverTimestamp(),
        reviewed_by: uid,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(reviewState));
  });

  it('rejects invalid monthly review state and settled-month review writes', async () => {
    await seedMonth('2026-07', false);
    await seedMonth('2026-08', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const payload = {
      month_id: '2026-07',
      employee_id: 'employee-1',
      teta_number: 'TETA-1001',
      review_status: 'CHECKED',
      review_note: '',
      reviewed_at: serverTimestamp(),
      reviewed_by: uid,
      ...modificationMetadata(uid),
    };

    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/reviewStates/wrong-id'), payload),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/reviewStates/employee-1'), {
        ...payload,
        review_status: 'DONE',
      }),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-08/reviewStates/employee-1'), {
        ...payload,
        month_id: '2026-08',
      }),
    );
  });

  it('allows manual daily value create, update, and delete in an open month', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const dailyValue = doc(
      firestore,
      'months/2026-07/dailyValues/employee-1_2026-07-14',
    );

    await assertSucceeds(
      setDoc(dailyValue, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-14',
        hours: 0,
        source: 'manual',
        import_id: null,
        note: null,
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(dailyValue, {
        hours: 7.5,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(deleteDoc(dailyValue));
  });

  it('allows schedule correction create, edit and cancellation in an open month', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const correction = doc(
      firestore,
      'months/2026-07/scheduleCorrections/employee-1_2026-07-14',
    );

    await assertSucceeds(
      setDoc(correction, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-14',
        kind: 'NIGHT_SHIFT',
        planned_shift: 'NIGHT',
        planned_hours: 8,
        note: 'Zmiana planu',
        status: 'ACTIVE',
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(correction, {
        planned_hours: 10,
        note: 'Praca dodatkowa',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(correction, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(correction));
  });

  it('rejects invalid schedule corrections and settled-month writes', async () => {
    await seedMonth('2026-07', false);
    await seedMonth('2026-08', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/scheduleCorrections/invalid-hours'),
        {
          employee_id: 'employee-1',
          teta_number: 'TETA-1001',
          date: '2026-07-14',
          kind: 'NIGHT_SHIFT',
          planned_shift: 'NIGHT',
          planned_hours: 25,
          note: null,
          status: 'ACTIVE',
          ...modificationMetadata(uid),
        },
      ),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-08/scheduleCorrections/settled'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-08-14',
        kind: 'FIRST_SHIFT',
        planned_shift: 'FIRST',
        planned_hours: 8,
        note: null,
        status: 'ACTIVE',
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows audited work-time correction on manual daily values', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const dailyValue = doc(
      firestore,
      'months/2026-07/dailyValues/employee-1_2026-07-14',
    );

    await assertSucceeds(
      setDoc(dailyValue, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-14',
        hours: 8,
        source: 'manual',
        import_id: null,
        note: 'Korekta czasu',
        work_time_correction: {
          planned_shift: 'FIRST',
          planned_start_time: '06:00',
          planned_end_time: '14:00',
          actual_start_time: '09:00',
          actual_end_time: '17:00',
          classification_override: null,
        },
        ...modificationMetadata(uid),
      }),
    );

    await assertFails(
      updateDoc(dailyValue, {
        work_time_correction: {
          planned_shift: 'FIRST',
          planned_start_time: 'bad',
          planned_end_time: '14:00',
          actual_start_time: '09:00',
          actual_end_time: '17:00',
          classification_override: null,
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
  });

  it('rejects non-canonical daily value document IDs', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/dailyValues/non-canonical-id'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-14',
        hours: 6,
        source: 'manual',
        import_id: null,
        note: null,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows only audited manual overrides on imported daily values', async () => {
    await seedMonth('2026-07', false);
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'months/2026-07/dailyValues/employee-1_2026-07-14',
        ),
        {
          employee_id: 'employee-1',
          teta_number: 'TETA-1001',
          date: '2026-07-14',
          hours: 6,
          source: 'attendance_import',
          import_id: 'import-1',
          note: null,
          manual_override: null,
          created_at: new Date('2026-07-15T00:00:00.000Z'),
          created_by: 'system',
          updated_at: new Date('2026-07-15T00:00:00.000Z'),
          updated_by: 'system',
        },
      );
    });

    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const dailyValue = doc(
      firestore,
      'months/2026-07/dailyValues/employee-1_2026-07-14',
    );
    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/dailyValues/employee-2_2026-07-14'),
        {
          employee_id: 'employee-2',
          teta_number: 'TETA-1002',
          date: '2026-07-14',
          hours: 7,
          source: 'attendance_import',
          import_id: 'import-2',
          note: null,
          manual_override: null,
          ...modificationMetadata(uid),
        },
      ),
    );
    await assertSucceeds(
      updateDoc(dailyValue, {
        manual_override: {
          hours: 8.5,
          note: 'Korekta koordynatora',
          actor_uid: uid,
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    const overridden = await getDoc(dailyValue);
    expect(overridden.data()).toMatchObject({
      hours: 6,
      source: 'attendance_import',
      import_id: 'import-1',
      manual_override: {
        hours: 8.5,
        note: 'Korekta koordynatora',
        actor_uid: uid,
      },
    });

    await assertSucceeds(
      updateDoc(dailyValue, {
        work_time_correction: {
          planned_shift: 'SECOND',
          planned_start_time: '14:00',
          planned_end_time: '22:00',
          actual_start_time: '14:00',
          actual_end_time: '00:00',
          classification_override: null,
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    const withWorkTimeCorrection = await getDoc(dailyValue);
    expect(withWorkTimeCorrection.data()).toMatchObject({
      hours: 6,
      source: 'attendance_import',
      import_id: 'import-1',
      work_time_correction: {
        planned_shift: 'SECOND',
        actual_end_time: '00:00',
      },
    });

    await assertFails(
      updateDoc(dailyValue, {
        work_time_correction: {
          planned_shift: 'SECOND',
          planned_start_time: '14:00',
          planned_end_time: '22:00',
          actual_start_time: '14:00',
          actual_end_time: '00:00',
          classification_override: {
            private_time_hours: null,
            overtime_50_hours: 0,
            overtime_100_hours: 2,
            coverable_ni_hours: null,
            note: null,
            actor_uid: uid,
            updated_at: serverTimestamp(),
          },
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );

    await assertFails(
      updateDoc(dailyValue, {
        hours: 8,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      updateDoc(dailyValue, {
        manual_override: {
          hours: 25,
          note: null,
          actor_uid: uid,
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      updateDoc(dailyValue, {
        manual_override: {
          hours: 7,
          note: null,
          actor_uid: 'different-user',
          updated_at: serverTimestamp(),
        },
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(dailyValue, {
        manual_override: null,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    const restored = await getDoc(dailyValue);
    expect(restored.data()).toMatchObject({
      hours: 6,
      source: 'attendance_import',
      import_id: 'import-1',
      manual_override: null,
    });
    await assertFails(deleteDoc(dailyValue));
  });

  it('rejects virtual defaults and absence data in daily values', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/dailyValues/employee-1_2026-07-02'),
        {
          employee_id: 'employee-1',
          teta_number: 'TETA-1001',
          date: '2026-07-02',
          hours: 8,
          source: 'default',
          absence_code: 'SICK',
          import_id: null,
          note: null,
          ...modificationMetadata(uid),
        },
      ),
    );

    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/dailyValues/employee-1_2026-07-03'),
        {
          employee_id: 'employee-1',
          teta_number: 'TETA-1001',
          date: '2026-07-03',
          hours: 25,
          source: 'manual',
          import_id: null,
          note: null,
          ...modificationMetadata(uid),
        },
      ),
    );
  });

  it('allows manual absence edits and cancellation but denies deletion', async () => {
    await seedMonth('2026-06', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const reference = doc(firestore, 'months/2026-06/absences/absence-1');

    await assertSucceeds(
      setDoc(reference, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        absence_code: 'UW',
        start_date: '2026-06-28',
        end_date: '2026-07-05',
        hours_per_day: null,
        source: 'manual',
        import_id: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        absence_code: 'UZ',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        status: 'ACTIVE',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  it('allows imported L4 creation but keeps imported absences read-only for client edits', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const reference = doc(firestore, 'months/2026-07/absences/imported-l4-1');

    await assertSucceeds(
      setDoc(reference, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        absence_code: 'L4',
        start_date: '2026-07-08',
        end_date: '2026-07-10',
        hours_per_day: null,
        source: 'absence_import',
        import_id: 'l4-test-batch',
        status: 'ACTIVE',
        note: 'L4 import: sanitized.xlsx, wiersz 2',
        ...modificationMetadata(uid),
      }),
    );

    await assertFails(
      updateDoc(reference, {
        note: 'manual change',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/absences/imported-without-id'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        absence_code: 'L4',
        start_date: '2026-07-11',
        end_date: '2026-07-12',
        hours_per_day: null,
        source: 'absence_import',
        import_id: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows owner-month absence reads and keeps broad collection-group reads denied', async () => {
    await seedMonth('2026-06', false);
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'months/2026-06/absences/l4-1'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        absence_code: 'L4',
        start_date: '2026-06-28',
        end_date: '2026-07-05',
        hours_per_day: null,
        source: 'manual',
        import_id: null,
        status: 'ACTIVE',
        note: null,
        created_at: new Date('2026-06-28T00:00:00.000Z'),
        created_by: 'coordinator-1',
        updated_at: new Date('2026-06-28T00:00:00.000Z'),
        updated_by: 'coordinator-1',
      });
    });

    const active = testEnvironment
      .authenticatedContext('coordinator-1')
      .firestore();
    await assertSucceeds(
      getDocs(collection(active, 'months/2026-06/absences')),
    );
    await assertFails(
      getDocs(
        query(
          collectionGroup(active, 'absences'),
          where('start_date', '<=', '2026-07-31'),
          orderBy('start_date'),
        ),
      ),
    );

    await seedAppUser('inactive-absence-reader', { active: false });
    const inactive = testEnvironment
      .authenticatedContext('inactive-absence-reader')
      .firestore();
    await assertFails(
      getDocs(
        query(
          collectionGroup(inactive, 'absences'),
          where('start_date', '<=', '2026-07-31'),
          orderBy('start_date'),
        ),
      ),
    );
  });

  it('requires ACTIVE creation and ownership by the start month', async () => {
    await seedMonth('2026-06', false);
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const payload = {
      employee_id: 'employee-1',
      teta_number: 'TETA-1001',
      absence_code: 'L4',
      start_date: '2026-06-28',
      end_date: '2026-07-05',
      hours_per_day: null,
      source: 'manual',
      import_id: null,
      status: 'ACTIVE',
      note: null,
      ...modificationMetadata(uid),
    };

    await assertFails(
      setDoc(doc(firestore, 'months/2026-07/absences/wrong-owner'), payload),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-06/absences/cancelled'), {
        ...payload,
        status: 'CANCELLED',
      }),
    );
  });

  it('denies absence writes beneath a settled owner month', async () => {
    await seedMonth('2026-06', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(firestore, 'months/2026-06/absences/absence-1'), {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        absence_code: 'L4',
        start_date: '2026-06-28',
        end_date: '2026-07-05',
        hours_per_day: null,
        source: 'manual',
        import_id: null,
        status: 'ACTIVE',
        note: null,
        ...modificationMetadata(uid),
      }),
    );
  });

  it('allows append-only global payroll setting versions', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const setting = doc(firestore, 'payrollSettings/frequency-2026-08');

    await assertSucceeds(
      setDoc(setting, {
        setting_key: 'frequency_bonus',
        variant_key: null,
        variant_name: null,
        amount: 400,
        valid_from: '2026-08',
        valid_to: null,
        active: true,
        description: 'Premia bazowa',
        ...modificationMetadata(uid),
      }),
    );
    await assertFails(
      updateDoc(setting, {
        amount: 450,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(setting));
  });

  it('rejects invalid payroll setting amounts and accommodation types', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const base = {
      setting_key: 'accommodation_allowance',
      variant_key: null,
      variant_name: null,
      amount: -1,
      valid_from: '2026-08',
      valid_to: '2026-07',
      active: true,
      description: '',
      ...modificationMetadata(uid),
    };

    await assertFails(
      setDoc(doc(firestore, 'payrollSettings/invalid-accommodation'), base),
    );
  });

  it('allows adjustment editing and cancellation but denies deletion', async () => {
    await seedMonth('2026-07', false);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const adjustment = doc(
      firestore,
      'months/2026-07/adjustments/adjustment-1',
    );

    await assertSucceeds(
      setDoc(adjustment, {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        category: 'MANUAL_BONUS',
        direction: 'INCREASE',
        amount: 100,
        note: '',
        status: 'ACTIVE',
        ...modificationMetadata(uid),
      }),
    );
    await assertSucceeds(
      updateDoc(adjustment, {
        amount: 125,
        note: 'Korekta',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      updateDoc(adjustment, {
        amount: -1,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertSucceeds(
      updateDoc(adjustment, {
        status: 'CANCELLED',
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(
      updateDoc(adjustment, {
        amount: 200,
        updated_at: serverTimestamp(),
        updated_by: uid,
      }),
    );
    await assertFails(deleteDoc(adjustment));
  });

  it('rejects invalid adjustment direction and settled-month writes', async () => {
    await seedMonth('2026-07', false);
    await seedMonth('2026-08', true);
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const payload = {
      employee_id: 'employee-1',
      teta_number: 'TETA-1001',
      category: 'MANUAL_DEDUCTION',
      direction: 'INCREASE',
      amount: 100,
      note: '',
      status: 'ACTIVE',
      ...modificationMetadata(uid),
    };

    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/adjustments/wrong-direction'),
        payload,
      ),
    );
    await assertFails(
      setDoc(doc(firestore, 'months/2026-08/adjustments/settled'), {
        ...payload,
        direction: 'DECREASE',
      }),
    );
  });

  it('keeps audit entries append-only and tied to the actor', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();
    const entry = doc(firestore, 'auditLog', 'entry-1');

    await assertSucceeds(
      setDoc(entry, {
        entity_path: 'employees/employee-1',
        action: 'create',
        actor_uid: uid,
        occurred_at: serverTimestamp(),
        changes: { teta_number: 'TETA-1001' },
      }),
    );
    await assertFails(updateDoc(entry, { action: 'update' }));
  });

  it('denies client-owned pipeline fields', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertFails(
      setDoc(doc(firestore, 'months', '2026-07'), {
        year: 2026,
        month: 7,
        month_start: new Date('2026-07-01T00:00:00.000Z'),
        month_end: new Date('2026-07-31T23:59:59.999Z'),
        is_settled: false,
        calculation_version: 0,
        calculation_status: 'completed',
        ...modificationMetadata(uid),
      }),
    );

    await assertFails(
      setDoc(doc(firestore, 'months', '2026-08'), {
        year: 2026,
        month: 8,
        month_start: new Date('2026-08-01T00:00:00.000Z'),
        month_end: new Date('2026-08-31T23:59:59.999Z'),
        is_settled: false,
        calculation_version: 1,
        ...modificationMetadata(uid),
      }),
    );
  });
});
