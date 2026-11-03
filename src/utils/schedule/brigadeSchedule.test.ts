import { describe, expect, it } from 'vitest';
import type { Department, Employee } from '../../types/firestore';
import { CANONICAL_DEPARTMENTS, EMPLOYEE_COLOR_SHIFTS } from '../organization';
import {
  calculateEmployeeMonthlyDraft,
  createPayrollMonthCalendar,
} from '../payroll';
import { resolveDailyWorkTimeDeviation } from '../payroll/workTimeDeviations';
import { plannedNightContext } from '../payroll/plannedNightContext';
import { generateEmployeeMonthlySchedule } from './monthlySchedule';
import {
  resolveBrigadeScheduleDay,
  validateBrigadeScheduleDay,
  type BrigadeScheduleDay,
} from './brigadeSchedule';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  updatedBy: 'test',
};
const employee: Employee = {
  id: 'e',
  tetaNumber: 'WT-1',
  firstName: 'Anna',
  lastName: 'Test',
  pesel: null,
  passportNumber: null,
  foreignDocumentNumber: null,
  isActive: true,
  departmentId: 'headliner-bmw',
  shiftAssignment: 'YELLOW',
  firstToyotaEmploymentDate: metadata.createdAt,
  employmentStartDate: metadata.createdAt,
  employmentEndDate: null,
  contracts: [
    {
      id: 'c',
      employeeId: 'e',
      tetaNumber: 'WT-1',
      sequenceId: 's',
      startDate: '2026-01-01',
      endDate: null,
      status: 'ACTIVE',
      note: null,
      ...metadata,
    },
  ],
  ...metadata,
};
const department: Department = {
  id: 'headliner-bmw',
  name: 'Headliner BMW',
  active: true,
  shiftMode: 'THREE_SHIFT',
  brigadeSchedulingFrom: '2026-10-01',
  ...metadata,
};
const days = createPayrollMonthCalendar('2026-10');
function entry(
  date: string,
  kind: BrigadeScheduleDay['kind'] = 'DAY_OFF',
  employeeId: string | null = null,
): BrigadeScheduleDay {
  return {
    id: date,
    departmentId: department.id,
    brigade: 'YELLOW',
    employeeId,
    date,
    kind,
    startTime: kind === 'DAY_OFF' ? null : kind === 'NIGHT' ? '18:00' : '06:00',
    endTime: kind === 'DAY_OFF' ? null : kind === 'NIGHT' ? '06:00' : '18:00',
    plannedHours: kind === 'DAY_OFF' ? 0 : 12,
    status: 'ACTIVE',
    note: null,
  };
}
const complete = () => days.map((d) => entry(d.isoDate));
const schedule = (
  plans: BrigadeScheduleDay[],
  worker = employee,
  dept = department,
) =>
  generateEmployeeMonthlySchedule({
    employee: worker,
    days,
    departments: [dept],
    options: { brigadeScheduleDays: plans },
  });
const calculate = (plan: ReturnType<typeof schedule>, worker = employee) =>
  calculateEmployeeMonthlyDraft({
    monthId: '2026-10',
    employee: worker,
    dailyValues: [],
    absences: [],
    payrollSettings: [],
    adjustments: [],
    plannedSchedule: plan,
  });

describe('explicit department opt-in brigade calendar', () => {
  it.each(CANONICAL_DEPARTMENTS.map((d) => [d.id, d] as const))(
    'preserves the complete non-brigade payroll for %s',
    (_, definition) => {
      const dept: Department = {
        ...department,
        id: definition.id,
        name: definition.uiName,
        shiftMode: definition.shiftMode,
        brigadeSchedulingFrom: undefined,
      };
      const worker = {
        ...employee,
        departmentId: dept.id,
        shiftAssignment: 'RED' as const,
      };
      const baseline = generateEmployeeMonthlySchedule({
        employee: worker,
        days,
        departments: [dept],
      });
      const withUnrelatedBrigadeInputs = schedule(
        [entry('2026-10-03', 'NIGHT')],
        worker,
        dept,
      );
      expect(withUnrelatedBrigadeInputs).toEqual(baseline);
      expect(calculate(withUnrelatedBrigadeInputs, worker)).toEqual(
        calculate(baseline, worker),
      );
    },
  );
  it('counts two explicit twelve-hour weekend shifts once, with zero for a weekday off', () => {
    const plans = complete().map((p) =>
      p.date === '2026-10-03'
        ? entry(p.date, 'DAY')
        : p.date === '2026-10-04'
          ? entry(p.date, 'NIGHT')
          : p,
    );
    const result = schedule(plans);
    expect(result.find((d) => d.date === '2026-10-05')?.hours).toBe(0);
    expect(calculate(result).totals.nominalHours).toBe(24);
    expect(
      result.filter((d) => d.status === 'WORKING').map((d) => d.date),
    ).toEqual(['2026-10-03', '2026-10-04']);
    const night = result.find((d) => d.date === '2026-10-04')!;
    const deviation = resolveDailyWorkTimeDeviation({
      planned: { shift: 'NIGHT', startTime: '18:00', endTime: '06:00' },
      actual: { startTime: '18:00', endTime: '06:00' },
      isWorkingDay: true,
      isSunday: true,
      ...plannedNightContext(night),
    });
    expect(deviation.normalWorkHours).toBe(12);
    expect(deviation.extraHours).toBe(0);
    expect(deviation.nightAllowanceHours).toBe(8);
  });
  it('does not invent unspecified dates and blocks payroll persistence via a warning', () => {
    const result = schedule([entry('2026-10-03', 'DAY')]);
    expect(result.find((d) => d.date === '2026-10-05')?.status).toBe(
      'UNRESOLVED',
    );
    expect(
      calculate(result).warnings.some(
        (w) => w.code === 'missing-brigade-schedule',
      ),
    ).toBe(true);
  });
  it('supports all five colors without guessing their weekday pattern', () => {
    for (const brigade of EMPLOYEE_COLOR_SHIFTS) {
      const worker = { ...employee, shiftAssignment: brigade };
      const plans = complete().map((p) => ({ ...p, brigade }));
      expect(schedule(plans, worker).every((d) => d.status === 'DAY_OFF')).toBe(
        true,
      );
    }
  });
  it('uses employee overrides, and cancellation restores the brigade plan', () => {
    const group = entry('2026-10-03', 'DAY'),
      override = { ...entry('2026-10-03', 'NIGHT', 'e'), id: 'individual' };
    expect(
      resolveBrigadeScheduleDay(
        [group, override],
        'e',
        department.id,
        'YELLOW',
        group.date,
      ),
    ).toEqual(override);
    expect(
      resolveBrigadeScheduleDay(
        [group, { ...override, status: 'CANCELLED' }],
        'e',
        department.id,
        'YELLOW',
        group.date,
      ),
    ).toEqual(group);
    expect(
      resolveBrigadeScheduleDay(
        [group, override],
        'other',
        department.id,
        'YELLOW',
        group.date,
      ),
    ).toEqual(group);
  });
  it('validates persisted round-trips and rejects mismatched hours', () => {
    const night = entry('2026-10-04', 'NIGHT');
    expect(validateBrigadeScheduleDay(JSON.parse(JSON.stringify(night)))).toBe(
      true,
    );
    expect(validateBrigadeScheduleDay({ ...night, plannedHours: 8 })).toBe(
      false,
    );
  });
  it('does not apply opt-in retroactively before its effective date', () => {
    const later = { ...department, brigadeSchedulingFrom: '2026-11-01' };
    expect(
      schedule(complete(), { ...employee, shiftAssignment: 'RED' }, later),
    ).toEqual(
      schedule(
        [],
        { ...employee, shiftAssignment: 'RED' },
        { ...later, brigadeSchedulingFrom: undefined },
      ),
    );
  });
});
