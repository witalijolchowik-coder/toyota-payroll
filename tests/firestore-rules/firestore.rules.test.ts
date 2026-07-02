import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
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

async function seedEmployee(employeeId: string) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'employees', employeeId), {
      teta_number: 'TETA-1001',
      first_name: 'Jan',
      last_name: 'Kowalski',
      is_active: true,
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
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe('Firestore security rules', () => {
  it('denies public access', async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(firestore, 'employees', 'employee-1')));
  });

  it('allows a valid authenticated employee create', async () => {
    const uid = 'coordinator-1';
    const firestore = testEnvironment.authenticatedContext(uid).firestore();

    await assertSucceeds(
      setDoc(doc(firestore, 'employees', 'employee-1'), {
        teta_number: 'TETA-1001',
        first_name: 'Test',
        last_name: 'Employee',
        is_active: true,
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
        employment_start_date: null,
        employment_end_date: null,
        ...modificationMetadata('another-user'),
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

    await assertFails(
      setDoc(
        doc(firestore, 'months/2026-07/dailyValues/employee-1_2026-07-02'),
        {
          employee_id: 'employee-1',
          teta_number: 'TETA-1001',
          date: '2026-07-02',
          hours: 6,
          source: 'manual',
          import_id: null,
          note: null,
          ...modificationMetadata(uid),
        },
      ),
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
