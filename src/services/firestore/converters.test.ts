import { Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore';

import type {
  DailyValueDocument,
  EmployeeDocument,
} from '../../types/firestore';
import { dailyValueConverter, employeeConverter } from './converters';
import { mapDailyValueDocument, mapEmployeeDocument } from './mappers';
import {
  assertIsoDate,
  assertMonthId,
  dailyValueDocumentId,
  firestorePaths,
} from './paths';
import { InvalidFirestoreDocumentError } from './validation';

function snapshot(
  path: string,
  data: Record<string, unknown>,
): QueryDocumentSnapshot {
  return {
    data: () => data,
    ref: { path },
  } as unknown as QueryDocumentSnapshot;
}

const now = Timestamp.fromDate(new Date('2026-07-02T08:00:00.000Z'));

describe('Firestore converters', () => {
  it('validates and maps an employee document', () => {
    const document = employeeConverter.fromFirestore(
      snapshot('employees/employee-1', {
        teta_number: 'TETA-1001',
        first_name: 'Test',
        last_name: 'Employee',
        is_active: true,
        employment_start_date: now,
        employment_end_date: null,
        created_at: now,
        created_by: 'test-user',
        updated_at: now,
        updated_by: 'test-user',
      }),
      {},
    );

    expect(document.teta_number).toBe('TETA-1001');
    expect(mapEmployeeDocument('employee-1', document)).toMatchObject({
      id: 'employee-1',
      tetaNumber: 'TETA-1001',
      employmentStartDate: new Date('2026-07-02T08:00:00.000Z'),
    });
  });

  it('rejects a malformed business identifier', () => {
    expect(() =>
      employeeConverter.fromFirestore(
        snapshot('employees/employee-1', {
          teta_number: '',
          first_name: 'Test',
          last_name: 'Employee',
          is_active: true,
          employment_start_date: null,
          employment_end_date: null,
          created_at: now,
          created_by: 'test-user',
          updated_at: now,
          updated_by: 'test-user',
        }),
        {},
      ),
    ).toThrow(InvalidFirestoreDocumentError);
  });

  it('maps an explicit daily value without adding employee names', () => {
    const document = dailyValueConverter.fromFirestore(
      snapshot('months/2026-07/dailyValues/employee-1_2026-07-02', {
        employee_id: 'employee-1',
        teta_number: 'TETA-1001',
        date: '2026-07-02',
        hours: 6,
        source: 'manual',
        import_id: null,
        note: null,
        created_at: now,
        created_by: 'test-user',
        updated_at: now,
        updated_by: 'test-user',
      }),
      {},
    );
    const domain = mapDailyValueDocument(
      'employee-1_2026-07-02',
      '2026-07',
      document,
    );

    expect(domain).toMatchObject({
      employeeId: 'employee-1',
      tetaNumber: 'TETA-1001',
      hours: 6,
    });
    expect(document).not.toHaveProperty('employee_name');
  });

  it('does not accept a virtual default as a persisted daily value', () => {
    const invalid = {
      employee_id: 'employee-1',
      teta_number: 'TETA-1001',
      date: '2026-07-02',
      hours: 8,
      source: 'default',
      import_id: null,
      note: null,
      created_at: now,
      created_by: 'test-user',
      updated_at: now,
      updated_by: 'test-user',
    };

    expect(() =>
      dailyValueConverter.fromFirestore(
        snapshot('months/2026-07/dailyValues/default', invalid),
        {},
      ),
    ).toThrow(InvalidFirestoreDocumentError);
  });

  it('preserves typed document writes', () => {
    const employee: EmployeeDocument = {
      teta_number: 'TETA-1001',
      first_name: 'Test',
      last_name: 'Employee',
      is_active: true,
      employment_start_date: null,
      employment_end_date: null,
      created_at: now,
      created_by: 'test-user',
      updated_at: now,
      updated_by: 'test-user',
    };

    expect(employeeConverter.toFirestore(employee)).toEqual(employee);
  });
});

describe('Firestore path helpers', () => {
  it('builds canonical collection and daily-value paths', () => {
    expect(firestorePaths.absences('2026-07')).toBe('months/2026-07/absences');
    expect(dailyValueDocumentId('employee-1', '2026-07-02')).toBe(
      'employee-1_2026-07-02',
    );
  });

  it('rejects invalid month IDs, dates, and path segments', () => {
    expect(() => assertMonthId('07-2026')).toThrow();
    expect(() => assertIsoDate('2026-02-30')).toThrow();
    expect(() => firestorePaths.employee('invalid/id')).toThrow();
  });

  it('keeps persisted daily-value sources explicit', () => {
    const source: DailyValueDocument['source'] = 'manual';
    expect(source).toBe('manual');
  });
});
