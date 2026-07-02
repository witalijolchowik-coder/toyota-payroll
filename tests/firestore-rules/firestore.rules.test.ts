import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
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
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'months', monthId), {
      year: Number(monthId.slice(0, 4)),
      month: Number(monthId.slice(5, 7)),
      is_settled: isSettled,
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
        is_settled: false,
        calculation_status: 'completed',
        ...modificationMetadata(uid),
      }),
    );
  });
});
