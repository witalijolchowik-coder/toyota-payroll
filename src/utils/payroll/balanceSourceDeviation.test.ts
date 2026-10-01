import {
  balanceDaily,
  balanceEmployee,
  balanceFacts,
} from '../attendance/balanceFixtures.test-support';
import {
  resolveBalanceCalendarDeviation,
  hasEffectiveBalanceSource,
} from './balanceSourceDeviation';
import { balanceMonthlyWorkTimeDeviations } from './workTimeDeviations';
import { calculateEmployeeMonthlyDraft } from './calculationDraft';
import { resolveEmploymentCoveredAbsence } from '../absences';
import {
  createCalendarDays,
  resolveSettlementCellValue,
} from '../../features/settlement/monthUtils';
import type { Absence } from '../../types/firestore';

describe('authoritative Balance quantity and source precedence', () => {
  it('does not use unexplained zero-work days as eligible overtime shortages', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        credited_hours: 0,
        actual_start_time: null,
        actual_end_time: null,
        absence_hours: 16,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      privateTimeHours: 0,
      normalWorkHours: 0,
      unresolved: true,
    });
    expect(result.issues).toContain('UNCONFIRMED_SHORTAGE_REVIEW');
  });
  it('A: credits normal 8 h without punch-derived overtime', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({ actual_start_time: '05:40', actual_end_time: '14:20' }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      extraHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      privateTimeHours: 0,
    });
  });
  it('B/C: credits exactly GODZ_ZLEC, ignoring client payment and time-off fields', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        credited_hours: 10,
        extra_hours: 2,
        actual_end_time: '16:30',
        presence_hours: 10.5,
        client_overtime_100_hours: 8,
        client_time_off_due_hours: 2,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      normalWorkHours: 8,
      extraHours: 2,
      overtime50Hours: 2,
      overtime100Hours: 0,
    });
  });
  it('uses credited night quantity to disambiguate a mixed rounded extra pool', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        planned_start_time: '14:00',
        planned_end_time: '22:00',
        actual_start_time: '13:40',
        actual_end_time: '00:01',
        credited_hours: 10,
        extra_hours: 2,
        night_hours: 2,
        presence_hours: 10.35,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      extraHours: 2,
      overtime100Hours: 2,
      overtime50Hours: 0,
      nightOvertimeHours: 2,
      unresolved: false,
    });
  });
  it('preserves ambiguous extra quantity without inventing its classification', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        planned_start_time: '22:00',
        planned_end_time: '06:00',
        actual_start_time: '21:40',
        actual_end_time: '06:00',
        credited_hours: 12,
        extra_hours: 4,
        night_hours: 8,
        presence_hours: 12.9167,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      extraHours: 4,
      overtime50Hours: 0,
      overtime100Hours: 0,
      unresolved: true,
    });
    expect(result.issues).toContain('EXTRA_CLASSIFICATION_REVIEW');
  });
  it('H: preserves credited work, never fabricates missing punches', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({ actual_end_time: null }),
      '2026-09-10',
      false,
    );
    expect(result.deviation.normalWorkHours).toBe(8);
    expect(result.issues).toContain('MISSING_PUNCH');
  });
  it('I: balances genuine shortages across dates, not cumulative/repaid private saldo', () => {
    const shortage = resolveBalanceCalendarDeviation(
      balanceFacts({
        credited_hours: 7,
        actual_end_time: '13:00',
        private_time_hours: 1,
        private_time_balance_hours: 12,
      }),
      '2026-09-10',
      false,
    ).deviation;
    const repaid = resolveBalanceCalendarDeviation(
      balanceFacts({
        private_time_hours: 8,
        private_time_repaid_hours: 8,
        private_time_balance_hours: 12,
      }),
      '2026-09-11',
      false,
    ).deviation;
    expect(repaid.privateTimeHours).toBe(0);
    expect(
      balanceMonthlyWorkTimeDeviations({
        privateTimeHours: shortage.privateTimeHours,
        coverableNiHours: 0,
        overtime50Hours: 2,
        overtime100Hours: 0,
      }),
    ).toMatchObject({
      privateTimeCoveredHours: 1,
      paidOvertime50Hours: 1,
      niedoczasHours: 0,
    });
  });
  it('J: night allowance remains independent from overtime and raw conflicts do not create work', () => {
    const result = resolveBalanceCalendarDeviation(
      balanceFacts({
        planned_start_time: '22:00',
        planned_end_time: '06:00',
        actual_start_time: '22:00',
        actual_end_time: '06:00',
        night_hours: 8,
      }),
      '2026-09-10',
      false,
    );
    expect(result.deviation).toMatchObject({
      nightAllowanceHours: 8,
      extraHours: 0,
      overtime100Hours: 0,
    });
    expect(
      resolveBalanceCalendarDeviation(
        balanceFacts({
          credited_hours: 0,
          night_hours: 8,
          actual_start_time: null,
          actual_end_time: null,
        }),
        '2026-09-10',
        false,
      ).deviation.nightAllowanceHours,
    ).toBe(0);
  });
  it('uses EXTRA without inventing a normative shift on a day off', () => {
    expect(
      resolveBalanceCalendarDeviation(
        balanceFacts({
          planned_hours: 0,
          planned_start_time: null,
          planned_end_time: null,
          credited_hours: 10,
          extra_hours: 10,
          night_hours: 2,
          actual_start_time: '14:00',
          actual_end_time: '00:00',
          presence_hours: 10,
        }),
        '2026-09-12',
        false,
      ).deviation,
    ).toMatchObject({
      normalWorkHours: 0,
      extraHours: 10,
      overtime100Hours: 8,
      overtime50Hours: 2,
      nightOvertimeHours: 2,
    });
  });
  it('D/E/F: L4 wins, its source stays whole, termination suppresses attendance', () => {
    const employee = balanceEmployee('2026-09-16');
    const value = balanceDaily('2026-09-17');
    const l4: Absence = {
      id: 'l4-1',
      monthId: '2026-09',
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      absenceCode: 'L4',
      startDate: '2026-09-15',
      endDate: '2026-09-20',
      hoursPerDay: null,
      source: 'absence_import',
      importId: 'l4-import',
      status: 'ACTIVE',
      note: null,
      createdAt: value.createdAt,
      createdBy: 'test',
      updatedAt: value.updatedAt,
      updatedBy: 'test',
    };
    const values = [balanceDaily('2026-09-15'), value];
    const result = calculateEmployeeMonthlyDraft({
      employee,
      monthId: '2026-09',
      dailyValues: values,
      absences: [l4],
      adjustments: [],
      payrollSettings: [],
    });
    expect(result.attendance.explicitHours).toBe(0);
    expect(
      resolveEmploymentCoveredAbsence(employee, [l4], '2026-09-16').kind,
    ).toBe('governed');
    expect(
      resolveEmploymentCoveredAbsence(employee, [l4], '2026-09-17').kind,
    ).toBe('none');
    expect(l4.endDate).toBe('2026-09-20');
    const day = createCalendarDays('2026-09').find(
      (d) => d.isoDate === value.date,
    )!;
    expect(
      resolveSettlementCellValue({ employee, day, persistedValue: value }),
    ).toMatchObject({ calendarState: 'outside-employment', hours: null });
  });
  it('G: imported source never supersedes manual overrides or operator intervals', () => {
    const value = balanceDaily();
    value.manualOverride = {
      hours: 6,
      note: 'operator',
      actorUid: 'test',
      updatedAt: value.updatedAt,
    };
    expect(hasEffectiveBalanceSource(value)).toBe(false);
    value.manualOverride = null;
    value.workTimeCorrection = {
      plannedShift: 'FIRST',
      plannedStartTime: '06:00',
      plannedEndTime: '14:00',
      actualStartTime: '06:00',
      actualEndTime: '12:00',
      classificationOverride: null,
    };
    expect(hasEffectiveBalanceSource(value)).toBe(false);
  });
});
