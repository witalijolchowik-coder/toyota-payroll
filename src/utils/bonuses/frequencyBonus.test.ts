import type { AbsenceRuleRecord } from '../absences';
import {
  calculateFrequencyBonus,
  isEmployedForFullPayrollMonth,
} from './frequencyBonus';

const fullMonthEmployment = {
  employmentStart: new Date('2026-01-10T00:00:00.000Z'),
  employmentEnd: null,
};

function absence(
  id: string,
  absenceCode: string,
  overrides: Partial<AbsenceRuleRecord> = {},
): AbsenceRuleRecord {
  return {
    id,
    employeeId: 'employee-1',
    absenceCode,
    startDate: '2026-07-10',
    endDate: '2026-07-10',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('frequency bonus', () => {
  it('recognizes employment covering the full calendar month', () => {
    expect(isEmployedForFullPayrollMonth('2026-07', fullMonthEmployment)).toBe(
      true,
    );
  });

  it('returns zero for partial-month employment', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: {
          employmentStart: new Date('2026-07-02T00:00:00.000Z'),
          employmentEnd: null,
        },
        absences: [],
      }),
    ).toMatchObject({ amount: 0, reason: 'PARTIAL_EMPLOYMENT' });
  });

  it.each([
    [0, 400],
    [1, 350],
    [2, 300],
    [3, 200],
    [4, 0],
    [5, 0],
  ])(
    'returns the approved amount for %s missed L4 workdays',
    (count, amount) => {
      const plannedWorkingDates = new Set(
        Array.from(
          { length: 5 },
          (_, index) => `2026-07-${String(6 + index).padStart(2, '0')}`,
        ),
      );
      const result = calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: count
          ? [
              absence('l4', 'L4', {
                startDate: '2026-07-06',
                endDate: `2026-07-${String(5 + count).padStart(2, '0')}`,
              }),
            ]
          : [],
        plannedWorkingDates,
      });

      expect(result.amount).toBe(amount);
      expect(result.l4MissedWorkingDayCount).toBe(count);
    },
  );

  it('does not automatically reduce the bonus for NN', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [absence('nn-1', 'NN')],
      }),
    ).toMatchObject({ amount: 400, hasNnAbsence: false, reason: 'ELIGIBLE' });
  });

  it('does not reduce the bonus for approved leave', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [
          absence('vacation', 'UW'),
          absence('justified', 'UZ'),
          absence('care', 'OPD'),
        ],
      }),
    ).toMatchObject({ amount: 400, l4RecordCount: 0, reason: 'ELIGIBLE' });
  });

  it('ignores cancelled and non-overlapping L4 records', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [
          absence('cancelled', 'L4', { status: 'CANCELLED' }),
          absence('august', 'L4', {
            startDate: '2026-08-01',
            endDate: '2026-08-03',
          }),
        ],
      }),
    ).toMatchObject({ amount: 400, l4RecordCount: 0 });
  });

  it('does not count weekend days inside an L4 period', () => {
    const result = calculateFrequencyBonus({
      monthId: '2026-07',
      employment: fullMonthEmployment,
      absences: [
        absence('weekend', 'L4', {
          startDate: '2026-07-11',
          endDate: '2026-07-12',
        }),
      ],
    });
    expect(result).toMatchObject({ amount: 400, l4MissedWorkingDayCount: 0 });
  });
});
