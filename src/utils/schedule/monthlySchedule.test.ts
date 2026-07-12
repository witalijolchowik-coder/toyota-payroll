import type {
  Department,
  Employee,
  EmployeeAssignment,
  ScheduleCorrection,
} from '../../types/firestore';
import { createCalendarDays } from '../../features/settlement/monthUtils';
import {
  getPublicHolidayNamesForYear,
  getPublicHolidaysForYear,
} from '../../features/settlement/publicHolidays';
import {
  generateEmployeeMonthlySchedule,
  hasNoBlankRelevantScheduleDays,
  resolveEffectiveAssignment,
  resolveRotatingShift,
} from './monthlySchedule';

describe('monthly schedule planning', () => {
  it('recognizes Polish public holidays including Corpus Christi 2026-06-04', () => {
    const holidays = getPublicHolidaysForYear(2026);
    const names = getPublicHolidayNamesForYear(2026);

    expect(holidays.has('2026-06-04')).toBe(true);
    expect(names.get('2026-06-04')).toBe('Boże Ciało');
  });

  it('rotates three-shift departments weekly using department-local anchor', () => {
    const metal = department('metal', 'Metal', 'THREE_SHIFT');

    expect(
      resolveRotatingShift({
        department: metal,
        shiftAssignment: 'BLUE',
        date: '2026-01-05',
      }),
    ).toBe('NIGHT');
    expect(
      resolveRotatingShift({
        department: metal,
        shiftAssignment: 'BLUE',
        date: '2026-01-12',
      }),
    ).toBe('SECOND');
    expect(
      resolveRotatingShift({
        department: metal,
        shiftAssignment: 'BLUE',
        date: '2026-01-19',
      }),
    ).toBe('FIRST');
  });

  it('rotates two-shift departments and rejects Blue in two-shift mode', () => {
    const szwalnia = department('szwalnia', 'Szwalnia', 'TWO_SHIFT');

    expect(
      resolveRotatingShift({
        department: szwalnia,
        shiftAssignment: 'RED',
        date: '2026-01-05',
      }),
    ).toBe('FIRST');
    expect(
      resolveRotatingShift({
        department: szwalnia,
        shiftAssignment: 'RED',
        date: '2026-01-12',
      }),
    ).toBe('SECOND');
    expect(
      resolveRotatingShift({
        department: szwalnia,
        shiftAssignment: 'BLUE',
        date: '2026-01-12',
      }),
    ).toBeNull();
  });

  it('uses effective-dated assignment transfers from the effective date', () => {
    const worker = employee({
      departmentId: 'metal',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const assignments: EmployeeAssignment[] = [
      assignment(worker, 'metal', 'RED', '2026-06-01', '2026-06-14'),
      assignment(worker, 'montaz', 'WHITE', '2026-06-15', null),
    ];

    expect(
      resolveEffectiveAssignment(worker, '2026-06-14', assignments),
    ).toEqual({ departmentId: 'metal', shiftAssignment: 'RED' });
    expect(
      resolveEffectiveAssignment(worker, '2026-06-15', assignments),
    ).toEqual({ departmentId: 'montaz', shiftAssignment: 'WHITE' });
  });

  it('marks first two working days from employment start as BHP and skips holidays', () => {
    const worker = employee({
      employmentStartDate: date('2026-06-04'),
      departmentId: 'metal',
      shiftAssignment: 'RED',
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal', 'Metal', 'THREE_SHIFT')],
      options: {
        publicHolidayNames: getPublicHolidayNamesForYear(2026),
      },
    });

    expect(schedule.find((day) => day.date === '2026-06-04')?.label).toBe('Ś');
    expect(schedule.find((day) => day.date === '2026-06-05')?.label).toBe(
      'BHP / 1',
    );
    expect(schedule.find((day) => day.date === '2026-06-08')?.label).toBe(
      'BHP / 1',
    );
  });

  it('applies manual schedule correction over automatic plan', () => {
    const worker = employee({
      departmentId: 'metal',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const corrections: ScheduleCorrection[] = [
      correction(worker, '2026-06-10', 'NIGHT_SHIFT', 'NIGHT', 8),
    ];
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal', 'Metal', 'THREE_SHIFT')],
      options: { corrections },
    });

    expect(schedule.find((day) => day.date === '2026-06-10')).toMatchObject({
      source: 'manual-correction',
      label: '8 / N',
    });
  });

  it('does not produce blank relevant days', () => {
    const worker = employee({
      departmentId: 'metal',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days: createCalendarDays('2026-06', {
        publicHolidays: getPublicHolidaysForYear(2026),
      }),
      departments: [department('metal', 'Metal', 'THREE_SHIFT')],
    });

    expect(hasNoBlankRelevantScheduleDays(schedule)).toBe(true);
  });
});

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function employee(overrides: Partial<Employee> = {}): Employee {
  const now = date('2026-06-01');
  return {
    id: 'employee-1',
    tetaNumber: 'WT-001',
    firstName: 'Anna',
    lastName: 'Kowalska',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: now,
    employmentEndDate: null,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
    ...overrides,
  };
}

function department(
  id: string,
  name: string,
  shiftMode: Department['shiftMode'],
): Department {
  const now = date('2026-06-01');
  return {
    id,
    name,
    shiftMode,
    active: true,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}

function assignment(
  worker: Employee,
  departmentId: string,
  shiftAssignment: NonNullable<Employee['shiftAssignment']>,
  validFrom: string,
  validTo: string | null,
): EmployeeAssignment {
  const now = date('2026-06-01');
  return {
    id: `${departmentId}-${validFrom}`,
    employeeId: worker.id,
    tetaNumber: worker.tetaNumber,
    departmentId,
    shiftAssignment,
    validFrom,
    validTo,
    status: 'ACTIVE',
    note: null,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}

function correction(
  worker: Employee,
  correctionDate: string,
  kind: ScheduleCorrection['kind'],
  plannedShift: ScheduleCorrection['plannedShift'],
  plannedHours: number,
): ScheduleCorrection {
  const now = date('2026-06-01');
  return {
    id: `${worker.id}-${correctionDate}`,
    monthId: '2026-06',
    employeeId: worker.id,
    tetaNumber: worker.tetaNumber,
    date: correctionDate,
    kind,
    plannedShift,
    plannedHours,
    note: 'test',
    status: 'ACTIVE',
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
