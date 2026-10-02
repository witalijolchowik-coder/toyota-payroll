import { Timestamp } from 'firebase/firestore';
import { balanceFacts } from '../utils/attendance/balanceFixtures.test-support';
import { planBalanceDailyValueUpsert } from './balanceImportService';
import type { DailyValueDocument } from '../types/firestore';
import { dailyValueConverter } from './firestore/converters';
import { mapDailyValueDocument } from './firestore/mappers';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

const facts = balanceFacts();
const input = {
  employeeId: 'employee-1',
  tetaNumber: 'TETA-1001',
  date: '2026-09-10',
  facts,
};
const existing: DailyValueDocument = {
  employee_id: input.employeeId,
  teta_number: input.tetaNumber,
  date: input.date,
  hours: 8,
  source: 'attendance_import',
  import_id: facts.import_id,
  note: null,
  manual_override: null,
  work_time_correction: null,
  balance_source_facts: facts,
  created_at: Timestamp.now(),
  created_by: 'test',
  updated_at: Timestamp.now(),
  updated_by: 'test',
};
describe('Balance typed source upsert', () => {
  it('round-trips raw facts through serializer and domain mapper', () => {
    const raw = dailyValueConverter.toFirestore(existing);
    const parsed = dailyValueConverter.fromFirestore({
      data: () => raw,
      ref: { path: 'months/2026-09/dailyValues/employee-1_2026-09-10' },
    } as unknown as QueryDocumentSnapshot);
    expect(
      mapDailyValueDocument('employee-1_2026-09-10', '2026-09', parsed)
        .balanceSourceFacts,
    ).toEqual(facts);
  });
  it('same source is unchanged: no writes or duplicate audit required', () => {
    expect(planBalanceDailyValueUpsert(existing, input).result).toBe(
      'unchanged',
    );
  });
  it('refreshes imported base but preserves the manual override', () => {
    const manual = {
      hours: 6,
      note: 'operator',
      actor_uid: 'test',
      updated_at: Timestamp.now(),
    };
    const result = planBalanceDailyValueUpsert(
      { ...existing, manual_override: manual },
      { ...input, facts: balanceFacts({ credited_hours: 10, extra_hours: 2 }) },
    );
    expect(result.result).toBe('manual-preserved');
    expect(result.patch).not.toHaveProperty('manual_override');
    expect(result.patch).not.toHaveProperty('work_time_correction');
    expect(result.patch).toMatchObject({ hours: 10 });
  });
  it('protects manual records and legacy intentional corrections', () => {
    expect(
      Object.keys(
        planBalanceDailyValueUpsert({ ...existing, source: 'manual' }, input)
          .patch,
      ),
    ).toEqual(['balance_source_facts']);
    const legacy = {
      ...existing,
      balance_source_facts: null,
      work_time_correction: {
        work_context: 'NORMATIVE' as const,
        planned_shift: 'FIRST' as const,
        planned_start_time: '06:00',
        planned_end_time: '14:00',
        actual_start_time: '06:00',
        actual_end_time: '12:00',
        classification_override: null,
      },
    };
    const result = planBalanceDailyValueUpsert(legacy, input);
    expect(result.result).toBe('manual-preserved');
    expect(result.patch).not.toHaveProperty('work_time_correction');
  });
  it('never duplicates automatic punches in operator corrections', () => {
    for (const source of [
      facts,
      balanceFacts({ actual_end_time: null }),
      balanceFacts({ planned_start_time: '07:00', planned_end_time: '15:00' }),
      balanceFacts({ planned_hours: 0 }),
    ]) {
      const result = planBalanceDailyValueUpsert(null, {
        ...input,
        facts: source,
      });
      expect(result.patch.balance_source_facts).toEqual(source);
      expect(result.patch).not.toHaveProperty('work_time_correction');
    }
  });
});
