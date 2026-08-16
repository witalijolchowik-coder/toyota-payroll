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

  it('sets the bonus to zero for NN', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [absence('nn-1', 'NN')],
      }),
    ).toMatchObject({ amount: 0, hasNnAbsence: true, reason: 'NN_ABSENCE' });
  });

  it('does not reduce the bonus for non-impacting leave and NI time off', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [
          absence('vacation', 'UW'),
          absence('paid', 'NU'),
          absence('occasional', 'UO'),
          absence('benefit', 'LO'),
          absence('time-off', 'NI', { overtimeTimeOff: true }),
        ],
      }),
    ).toMatchObject({ amount: 400, l4RecordCount: 0, reason: 'ELIGIBLE' });
  });

  it('counts unique working dates across impacting absence categories', () => {
    const result = calculateFrequencyBonus({
      monthId: '2026-07',
      employment: fullMonthEmployment,
      absences: [
        absence('ni', 'NI', {
          startDate: '2026-07-06',
          endDate: '2026-07-07',
        }),
        absence('op', 'OP', {
          startDate: '2026-07-07',
          endDate: '2026-07-08',
        }),
      ],
      plannedWorkingDates: new Set(['2026-07-06', '2026-07-07', '2026-07-08']),
    });

    expect(result).toMatchObject({
      amount: 200,
      affectingAbsenceDayCount: 3,
    });
  });

  it('uses the threshold scale from the effective setting version', () => {
    const result = calculateFrequencyBonus({
      monthId: '2026-07',
      employment: fullMonthEmployment,
      absences: [
        absence('l4', 'L4', {
          startDate: '2026-07-06',
          endDate: '2026-07-07',
        }),
      ],
      plannedWorkingDates: new Set(['2026-07-06', '2026-07-07']),
      thresholdScale: { 0: 500, 1: 425, 2: 325, 3: 225, 4: 25 },
    });

    expect(result.amount).toBe(325);
  });

  it('uses the configured full amount when there are no impacting days', () => {
    expect(
      calculateFrequencyBonus({
        monthId: '2026-07',
        employment: fullMonthEmployment,
        absences: [],
        fullConfiguredAmount: 475,
      }).amount,
    ).toBe(475);
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
