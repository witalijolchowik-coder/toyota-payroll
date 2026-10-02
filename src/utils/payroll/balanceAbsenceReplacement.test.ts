import type { Absence } from '../../types/firestore';
import {
  balanceDaily,
  balanceEmployee,
  balanceFacts,
} from '../attendance/balanceFixtures.test-support';
import { calculateEmployeeMonthlyDraft } from './calculationDraft';

const date = '2026-09-10';
const employee = balanceEmployee(date);
employee.contracts![0]!.startDate = date;
employee.employmentStartDate = new Date(`${date}T00:00:00Z`);
const daily = balanceDaily(
  date,
  balanceFacts({
    planned_start_time: '14:00',
    planned_end_time: '22:00',
    actual_start_time: '14:00',
    actual_end_time: '00:00',
    credited_hours: 10,
    extra_hours: 2,
    night_hours: 2,
    presence_hours: 10,
  }),
);
const absence: Absence = {
  id: 'operator-absence',
  employeeId: employee.id,
  tetaNumber: employee.tetaNumber,
  monthId: '2026-09',
  absenceCode: 'UW',
  startDate: date,
  endDate: date,
  hoursPerDay: null,
  source: 'manual',
  importId: null,
  status: 'ACTIVE',
  note: null,
  createdAt: daily.createdAt,
  createdBy: 'test',
  updatedAt: daily.updatedAt,
  updatedBy: 'test',
};
function calculate(value = daily, absences = [absence]) {
  return calculateEmployeeMonthlyDraft({
    employee,
    monthId: '2026-09',
    dailyValues: [value],
    absences,
    adjustments: [],
    payrollSettings: [],
  });
}

describe('manual absence governs raw Balance attendance', () => {
  it.each(['UW', 'UO', 'NN', 'NI'])(
    'suppresses imported 8 h with manual %s without an attendance conflict',
    (code) => {
      const value = balanceDaily(date);
      const result = calculate(value, [{ ...absence, absenceCode: code }]);
      expect(result.attendance.workedHoursTotal).toBe(0);
      expect(result.attendance.conflictDays).toEqual([]);
      expect(result.absences.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code, nominalHours: 8 }),
        ]),
      );
      expect(value.balanceSourceFacts).toEqual(balanceFacts());
      expect(value.hours).toBe(8);
    },
  );
  it('suppresses GODZ_ZLEC, night pay and work-day allowances with the imported 10 h', () => {
    const result = calculate();
    expect(result.attendance.workedHoursTotal).toBe(0);
    expect(result.workDays.physicallyWorkedDays).toBe(0);
    expect(result.workTime).toMatchObject({
      normalWorkHours: 0,
      nightHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      paidOvertime50Hours: 0,
      paidOvertime100Hours: 0,
      holidayWorkBonusEligible: false,
    });
    expect(
      result.warnings.some(
        (warning) => warning.code === 'attendance-absence-conflict',
      ),
    ).toBe(false);
    expect(daily.hours).toBe(10);
    expect(daily.balanceSourceFacts?.extra_hours).toBe(2);
  });
  it('restores raw Balance after cancellation, never an override cleared by replacement', () => {
    const cleared = {
      ...daily,
      manualOverride: null,
      workTimeCorrection: null,
    };
    const result = calculate(cleared, [{ ...absence, status: 'CANCELLED' }]);
    expect(result.attendance).toMatchObject({
      workedHoursTotal: 10,
      importedHours: 10,
      importedOverrideHours: 0,
    });
    expect(result.workTime).toMatchObject({
      nightHours: 2,
      overtime100Hours: 2,
    });
    expect(result.absences.vacationHours).toBe(0);
  });
  it('retains a subsequent explicit operator correction when the absence is cancelled', () => {
    const result = calculate(
      {
        ...daily,
        manualOverride: {
          hours: 6,
          note: 'new operator decision',
          actorUid: 'test',
          updatedAt: daily.updatedAt,
        },
        workTimeCorrection: {
          plannedShift: 'SECOND',
          plannedStartTime: '14:00',
          plannedEndTime: '22:00',
          actualStartTime: '14:00',
          actualEndTime: '20:00',
          classificationOverride: null,
        },
      },
      [{ ...absence, status: 'CANCELLED' }],
    );
    expect(result.attendance).toMatchObject({
      workedHoursTotal: 6,
      importedOverrideHours: 6,
    });
    expect(result.workTime.nightHours).toBe(0);
    expect(daily.hours).toBe(10);
  });
  it('does not hide genuine imported L4/source attendance conflicts', () => {
    const result = calculate(daily, [
      {
        ...absence,
        absenceCode: 'L4',
        source: 'absence_import',
        importId: 'zus',
      },
    ]);
    expect(result.attendance.conflictDays).toEqual([date]);
    expect(result.attendance.workedHoursTotal).toBe(0);
    expect(result.absences.l4Hours).toBe(8);
  });
});
