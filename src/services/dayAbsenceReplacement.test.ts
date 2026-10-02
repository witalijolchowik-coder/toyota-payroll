import { vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { balanceFacts } from '../utils/attendance/balanceFixtures.test-support';
import { saveDayAbsence, cancelAbsence } from './absencesService';
import {
  saveManualDailyValue,
  clearManualDailyValue,
} from './dailyValueService';
import { mapAbsenceDocument } from './firestore/mappers';
import type { AbsenceDocument } from '../types/firestore';

type Data = Record<string, unknown>;
type Reference = { path: string; id: string };
const database = vi.hoisted(() => ({
  records: new Map<string, Data>(),
  writes: [] as { path: string; data?: Data; operation: string }[],
  nextId: 0,
}));
vi.mock('../config/firebase', () => ({
  auth: {
    currentUser: { uid: 'coordinator-1' },
    authStateReady: async () => undefined,
  },
}));
vi.mock('./firestoreService', () => ({
  getFirestoreClient: () => ({}),
  getFirestoreRepositories: () => ({
    auditLog: { path: 'auditLog' },
    forMonth: (month: string) => ({
      month: { path: `months/${month}` },
      dailyValues: { path: `months/${month}/dailyValues` },
      absences: { path: `months/${month}/absences` },
    }),
  }),
}));
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  const snapshot = (path: string) => ({
    exists: () => database.records.has(path),
    data: () => database.records.get(path),
    id: path.split('/').at(-1),
  });
  const transaction = () => {
    const pending: typeof database.writes = [];
    return {
      get: async (ref: Reference) => {
        if (pending.length) throw new Error('read-after-write');
        return snapshot(ref.path);
      },
      set: (ref: Reference, data: Data) =>
        pending.push({ path: ref.path, data, operation: 'set' }),
      update: (ref: Reference, data: Data) =>
        pending.push({ path: ref.path, data, operation: 'update' }),
      delete: (ref: Reference) =>
        pending.push({ path: ref.path, operation: 'delete' }),
      commit: async () => {
        for (const write of pending) {
          database.writes.push(write);
          if (write.operation === 'delete') database.records.delete(write.path);
          else
            database.records.set(
              write.path,
              write.operation === 'update'
                ? { ...database.records.get(write.path), ...write.data }
                : write.data!,
            );
        }
      },
    };
  };
  return {
    ...original,
    doc: (collection: { path: string }, id = `new-${++database.nextId}`) => ({
      path: `${collection.path}/${id}`,
      id,
    }),
    getDoc: async (ref: Reference) => snapshot(ref.path),
    getDocs: async (collection: { path: string }) => ({
      docs: [...database.records]
        .filter(([path]) => path.startsWith(`${collection.path}/`))
        .map(([path]) => snapshot(path)),
    }),
    serverTimestamp: () =>
      original.Timestamp.fromDate(new Date('2026-10-02T08:00:00Z')),
    runTransaction: async (
      _db: unknown,
      action: (tx: ReturnType<typeof transaction>) => Promise<unknown>,
    ) => {
      const tx = transaction();
      await action(tx);
      await tx.commit();
    },
    writeBatch: transaction,
  };
});

const dailyPath = 'months/2026-09/dailyValues/employee-1_2026-09-10';
const input = {
  employeeId: 'employee-1',
  tetaNumber: 'TETA-1001',
  absenceCode: 'UW',
  startDate: '2026-09-10',
  endDate: '2026-09-10',
  hoursPerDay: null,
  note: 'Operator decision',
};
function importedAttendance(): Data {
  const facts = balanceFacts();
  return {
    employee_id: input.employeeId,
    teta_number: input.tetaNumber,
    date: input.startDate,
    source: 'attendance_import',
    hours: 8,
    import_id: facts.import_id,
    balance_source_facts: facts,
    manual_override: null,
    work_time_correction: null,
    note: null,
    created_by: 'importer',
    created_at: new Date('2026-10-01'),
    updated_by: 'importer',
    updated_at: new Date('2026-10-01'),
  };
}
beforeEach(() => {
  database.records.clear();
  database.writes = [];
  database.nextId = 0;
  database.records.set('months/2026-09', { is_settled: false });
  database.records.set(dailyPath, importedAttendance());
});

describe('operator decisions over imported Balance attendance', () => {
  it('creates an ACTIVE manual absence without writing or deleting raw Balance', async () => {
    const original = database.records.get(dailyPath);
    const id = await saveDayAbsence({ input });
    expect(database.records.get(dailyPath)).toEqual(original);
    expect(database.writes.filter((write) => write.path === dailyPath)).toEqual(
      [],
    );
    expect(database.records.get(`months/2026-09/absences/${id}`)).toMatchObject(
      {
        source: 'manual',
        status: 'ACTIVE',
        absence_code: 'UW',
        start_date: input.startDate,
      },
    );
    expect(
      database.writes.find((write) => write.path.startsWith('auditLog/'))?.data
        ?.changes,
    ).toMatchObject({
      imported_attendance_preserved: true,
      attendance_path: dailyPath,
    });
  });
  it('clears an effective manual override atomically and retains its historical evidence', async () => {
    const previousOverride = {
      hours: 6,
      note: 'earlier correction',
      actor_uid: 'coordinator-1',
    };
    const previousTimes = {
      actual_start_time: '06:00',
      actual_end_time: '12:00',
    };
    const original = importedAttendance();
    database.records.set(dailyPath, {
      ...original,
      manual_override: previousOverride,
      work_time_correction: previousTimes,
    });
    await saveDayAbsence({ input });
    expect(database.records.get(dailyPath)).toMatchObject({
      hours: 8,
      import_id: original.import_id,
      balance_source_facts: original.balance_source_facts,
      manual_override: null,
      work_time_correction: null,
    });
    const dailyWrite = database.writes.find(
      (write) => write.path === dailyPath,
    )!;
    expect(Object.keys(dailyWrite.data!).sort()).toEqual([
      'manual_override',
      'updated_at',
      'updated_by',
      'work_time_correction',
    ]);
    expect(
      database.writes.find((write) => write.data?.entity_path === dailyPath)
        ?.data?.changes,
    ).toMatchObject({
      previous_manual_override: previousOverride,
      previous_work_time_correction: previousTimes,
      balance_source_preserved: true,
      change_kind: 'attendance-override-replaced-by-absence',
    });
  });
  it('clears a typed Balance operator interval even without a numeric override', async () => {
    database.records.set(dailyPath, {
      ...importedAttendance(),
      work_time_correction: { actual_end_time: '12:00' },
    });
    await saveDayAbsence({ input });
    expect(database.records.get(dailyPath)?.work_time_correction).toBeNull();
  });
  it('cancels the manual absence without deleting raw attendance or reinstating old overrides', async () => {
    database.records.set(dailyPath, {
      ...importedAttendance(),
      manual_override: { hours: 6 },
    });
    const id = await saveDayAbsence({ input });
    const absencePath = `months/2026-09/absences/${id}`;
    await cancelAbsence(
      mapAbsenceDocument(
        id,
        '2026-09',
        database.records.get(absencePath)! as unknown as AbsenceDocument,
      ),
    );
    expect(database.records.get(absencePath)?.status).toBe('CANCELLED');
    expect(database.records.get(dailyPath)).toMatchObject({
      hours: 8,
      manual_override: null,
      balance_source_facts: balanceFacts(),
    });
  });
  it('saves numeric hours and actual times only as an override, then restores raw Balance', async () => {
    const original = importedAttendance();
    await saveManualDailyValue('2026-09', {
      employeeId: input.employeeId,
      tetaNumber: input.tetaNumber,
      date: input.startDate,
      hours: 6,
      note: 'corrected',
      workTimeCorrection: {
        plannedShift: 'FIRST',
        plannedStartTime: '06:00',
        plannedEndTime: '14:00',
        actualStartTime: '06:00',
        actualEndTime: '12:00',
        classificationOverride: null,
      },
    });
    expect(database.records.get(dailyPath)).toMatchObject({
      hours: 8,
      balance_source_facts: original.balance_source_facts,
      import_id: original.import_id,
      manual_override: { hours: 6 },
      work_time_correction: { actual_end_time: '12:00' },
    });
    await clearManualDailyValue('2026-09', input.employeeId, input.startDate);
    expect(database.records.get(dailyPath)).toMatchObject({
      hours: 8,
      balance_source_facts: original.balance_source_facts,
      import_id: original.import_id,
      manual_override: null,
      work_time_correction: null,
    });
  });
  it('keeps imported L4 protected and does not touch its Balance attendance', async () => {
    database.records.set('months/2026-09/absences/l4', {
      employee_id: input.employeeId,
      teta_number: input.tetaNumber,
      start_date: input.startDate,
      end_date: input.endDate,
      absence_code: 'L4',
      source: 'absence_import',
      status: 'ACTIVE',
      import_id: 'zus',
      hours_per_day: null,
      note: null,
      created_at: Timestamp.fromDate(new Date('2026-10-01')),
      created_by: 'test',
      updated_at: Timestamp.fromDate(new Date('2026-10-01')),
      updated_by: 'test',
    });
    await expect(saveDayAbsence({ input })).rejects.toMatchObject({
      code: 'l4-overlap',
    });
    expect(database.writes).toEqual([]);
  });
  it('rejects an absence in a locked month without writing anything', async () => {
    database.records.set('months/2026-09', { is_settled: true });
    await expect(saveDayAbsence({ input })).rejects.toMatchObject({
      code: 'month-settled',
    });
    expect(database.writes).toEqual([]);
  });
});
