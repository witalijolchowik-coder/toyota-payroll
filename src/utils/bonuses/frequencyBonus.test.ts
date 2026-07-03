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
  ])('returns %s L4 amount from the approved schedule', (count, amount) => {
    const result = calculateFrequencyBonus({
      monthId: '2026-07',
      employment: fullMonthEmployment,
      absences: Array.from({ length: count }, (_, index) =>
        absence(`l4-${index}`, 'L4'),
      ),
    });

    expect(result.amount).toBe(amount);
    expect(result.l4RecordCount).toBe(count);
  });

  it('returns zero when at least one NN absence overlaps the month', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [absence('nn-1', 'NN')],
      }),
    ).toMatchObject({
      amount: 0,
      hasNnAbsence: true,
      reason: 'NN_ABSENCE',
    });
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
});
