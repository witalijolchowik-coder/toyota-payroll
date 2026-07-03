import type { IsoDate } from '../../types/firestore';
import {
  absenceEmploymentIssue,
  absenceRangesOverlap,
  absenceRemovesVirtualDefault,
  findBlockingL4,
  resolveGoverningAbsence,
  validateAbsenceInput,
  type AbsenceRuleRecord,
} from '.';

function absence(
  overrides: Partial<AbsenceRuleRecord> = {},
): AbsenceRuleRecord {
  return {
    id: 'absence-1',
    employeeId: 'employee-1',
    absenceCode: 'UW',
    startDate: '2026-06-10',
    endDate: '2026-06-12',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('absence validation and record boundaries', () => {
  it('keeps each submitted source record independent', () => {
    const first = absence({ id: 'l4-1', absenceCode: 'L4' });
    const second = absence({
      id: 'l4-2',
      absenceCode: 'L4',
      startDate: '2026-06-13',
      endDate: '2026-06-15',
    });

    expect([first, second]).toHaveLength(2);
    expect(first.id).not.toBe(second.id);
  });

  it('validates supported codes, ranges, and ownership month', () => {
    expect(
      validateAbsenceInput({
        employeeId: 'employee-1',
        absenceCode: 'UŻ',
        startDate: '2026-06-10',
        endDate: '2026-06-12',
      }),
    ).toEqual({});
    expect(
      validateAbsenceInput(
        {
          employeeId: 'employee-1',
          absenceCode: 'NEW',
          startDate: '2026-07-10',
          endDate: '2026-07-01',
        },
        '2026-06',
      ),
    ).toEqual({
      absenceCode: 'unsupported-code',
      startDate: 'ownership-month-change',
      endDate: 'invalid-range',
    });
  });
});

describe('absence overlap and L4 priority', () => {
  it('detects inclusive date-range overlap', () => {
    expect(
      absenceRangesOverlap(
        absence({ endDate: '2026-06-10' }),
        absence({ startDate: '2026-06-10' }),
      ),
    ).toBe(true);
    expect(
      absenceRangesOverlap(
        absence({ endDate: '2026-06-09' }),
        absence({ startDate: '2026-06-10' }),
      ),
    ).toBe(false);
  });

  it('blocks non-L4 over an existing ACTIVE L4', () => {
    const l4 = absence({ id: 'l4', absenceCode: 'L4' });
    expect(findBlockingL4([l4], absence({ id: 'candidate' }))).toBe(l4);
    expect(
      findBlockingL4(
        [absence({ id: 'cancelled', absenceCode: 'L4', status: 'CANCELLED' })],
        absence(),
      ),
    ).toBeNull();
  });

  it('accepts L4 over non-L4 and resolves it day by day without changing statuses', () => {
    const leave = absence({ id: 'leave', absenceCode: 'UW' });
    const l4 = absence({ id: 'l4', absenceCode: 'L4' });
    const records = [leave, l4];

    expect(findBlockingL4(records, l4)).toBeNull();
    expect(resolveGoverningAbsence(records, '2026-06-11')).toMatchObject({
      kind: 'governed',
      code: 'L4',
      records: [l4],
      overriddenRecords: [leave],
    });
    expect(records.every((record) => record.status === 'ACTIVE')).toBe(true);
  });

  it('reports different overlapping non-L4 categories as ambiguous', () => {
    expect(
      resolveGoverningAbsence(
        [absence(), absence({ id: 'nn', absenceCode: 'NN' })],
        '2026-06-11',
      ),
    ).toMatchObject({ kind: 'ambiguous', codes: ['UW', 'NN'] });
  });
});

describe('calendar and employment safety', () => {
  it('keeps an absence on a non-working day and removes the virtual default', () => {
    const resolution = resolveGoverningAbsence(
      [absence({ startDate: '2026-06-14', endDate: '2026-06-14' })],
      '2026-06-14' as IsoDate,
    );
    expect(resolution.kind).toBe('governed');
    expect(absenceRemovesVirtualDefault(resolution)).toBe(true);
  });

  it('detects absences outside the employment period', () => {
    expect(
      absenceEmploymentIssue(absence(), {
        employmentStart: new Date('2026-06-11T00:00:00.000Z'),
        employmentEnd: null,
      }),
    ).toBe('outside-employment');
    expect(
      absenceEmploymentIssue(absence(), {
        employmentStart: new Date('2026-01-01T00:00:00.000Z'),
        employmentEnd: new Date('2026-12-31T00:00:00.000Z'),
      }),
    ).toBeNull();
  });
});
