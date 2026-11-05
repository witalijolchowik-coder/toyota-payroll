import { describe, expect, it } from 'vitest';
import type { Department, Employee } from '../../types/firestore';
import { CANONICAL_DEPARTMENTS, EMPLOYEE_COLOR_SHIFTS } from '../organization';
import {
  calculateEmployeeMonthlyDraft,
  createPayrollMonthCalendar,
} from '../payroll';
import { resolveDailyWorkTimeDeviation } from '../payroll/workTimeDeviations';
import { plannedNightContext } from '../payroll/plannedNightContext';
import {
  generateEmployeeMonthlySchedule,
  scheduledNominalHours,
} from './monthlySchedule';
import { october2026Schedule } from './october2026.test-support';
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
  it.each([
    ['YELLOW', 123],
    ['ORANGE', 124],
    ['RED', 148],
    ['BLUE', 148],
    ['WHITE', 176],
  ] as const)(
    'derives Headliner %s reference nominal from dates, including the rollback override',
    (brigade, total) => {
      const worker = { ...employee, shiftAssignment: brigade };
      const plans = october2026Schedule(brigade);
      if (brigade === 'YELLOW')
        plans.push({
          ...plans.find((p) => p.date === '2026-10-24')!,
          id: 'rollback-individual',
          employeeId: worker.id,
          endTime: '05:00',
          plannedHours: 11,
        });
      const plan = schedule(plans, worker);
      expect(scheduledNominalHours(plan)).toBe(total);
      expect(calculate(plan, worker).totals.nominalHours).toBe(total);
    },
  );

  it('separates a full reference month from employment coverage without changing payroll', () => {
    const plans = october2026Schedule('BLUE');
    const worker: Employee = {
      ...employee,
      shiftAssignment: 'BLUE',
      contracts: [
        { ...employee.contracts![0]!, startDate: '2026-10-19', endDate: null },
      ],
    };
    const covered = schedule(plans, worker);
    const full = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department],
      options: { brigadeScheduleDays: plans, fullMonthReference: true },
    });
    expect(scheduledNominalHours(full)).toBe(148);
    expect(scheduledNominalHours(covered)).toBe(52);
    expect(
      covered.slice(0, 18).every((d) => d.status === 'OUTSIDE_EMPLOYMENT'),
    ).toBe(true);
    const baseline = calculate(covered, worker);
    const informational = calculateEmployeeMonthlyDraft({
      monthId: '2026-10',
      employee: worker,
      dailyValues: [],
      absences: [],
      payrollSettings: [],
      adjustments: [],
      plannedSchedule: covered,
      fullMonthScheduleNominalHours: scheduledNominalHours(full),
    });
    expect(informational).toEqual({
      ...baseline,
      employment: {
        ...baseline.employment,
        fullMonthScheduleNominalHours: 148,
      },
    });
  });

  it.each(['metal-402b', 'szwalnia-toyota', 'montaz-toyota'])(
    'never applies Headliner RED hours to %s',
    (departmentId) => {
      const worker = {
        ...employee,
        departmentId,
        shiftAssignment: 'RED' as const,
      };
      const otherDepartment = {
        ...department,
        id: departmentId,
        brigadeSchedulingFrom: null,
      };
      const plan = generateEmployeeMonthlySchedule({
        employee: worker,
        days,
        departments: [department, otherDepartment],
        options: {
          brigadeScheduleDays: october2026Schedule('RED'),
          fullMonthReference: true,
        },
      });
      expect(scheduledNominalHours(plan)).toBe(176);
      expect(plan.every((d) => !d.brigadeScheduled)).toBe(true);
    },
  );

  it.each([
    ['ORANGE', 124],
    ['YELLOW', 124],
    ['RED', 148],
    ['WHITE', 176],
    ['BLUE', 148],
    [null, 148],
  ] as const)(
    'validates the complete October %s calendar and nominal',
    (brigade, nominal) => {
      const entries = october2026Schedule(
        brigade,
        brigade === null ? employee.id : null,
      );
      const dept = {
        ...department,
        id: entries[0]!.departmentId,
        individualSchedulingOnly: brigade === null,
      };
      const worker = {
        ...employee,
        departmentId: dept.id,
        shiftAssignment: brigade,
      };
      expect(entries.map((d) => d.date)).toEqual(days.map((d) => d.isoDate));
      expect(entries.every(validateBrigadeScheduleDay)).toBe(true);
      const plan = schedule(JSON.parse(JSON.stringify(entries)), worker, dept);
      expect(plan.map((d) => d.hours)).toEqual(
        entries.map((d) => d.plannedHours),
      );
      expect(calculate(plan, worker).totals.nominalHours).toBe(nominal);
      for (const [index, entry] of entries.entries()) {
        if (entry.dayOffCode) expect(plan[index]?.label).toBe(entry.dayOffCode);
        if (entry.startTime === '14:00')
          expect(plan[index]?.shift).toBe('SECOND');
        if (entry.startTime === '18:00')
          expect(plan[index]).toMatchObject({
            date: entry.date,
            plannedStartTime: '18:00',
            plannedEndTime: '06:00',
            hours: 12,
          });
      }
    },
  );

  it('keeps the default plan for employees without a brigade or individual plan', () => {
    const worker = { ...employee, shiftAssignment: null };
    expect(schedule(october2026Schedule('RED'), worker)).toEqual(
      schedule([], worker, { ...department, brigadeSchedulingFrom: undefined }),
    );
  });
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
