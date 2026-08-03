import type {
  Department,
  DepartmentShiftCorrection,
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
  resolveEffectiveAssignmentPresentation,
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
    const metal = department('metal-402b', 'Metal 402B', 'THREE_SHIFT');

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
    const szwalnia = department(
      'szwalnia-toyota',
      'Szwalnia Toyota',
      'TWO_SHIFT',
    );

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
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const assignments: EmployeeAssignment[] = [
      assignment(worker, 'metal-402b', 'RED', '2026-06-01', '2026-06-14'),
      assignment(worker, 'montaz-toyota', 'WHITE', '2026-06-15', null),
    ];

    expect(
      resolveEffectiveAssignment(worker, '2026-06-14', assignments),
    ).toMatchObject({ departmentId: 'metal-402b', shiftAssignment: 'RED' });
    expect(
      resolveEffectiveAssignment(worker, '2026-06-15', assignments),
    ).toMatchObject({
      departmentId: 'montaz-toyota',
      shiftAssignment: 'WHITE',
    });
  });

  it('uses dated Red instead of master Blue for generation and presentation', () => {
    const worker = employee({
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const assignments = [
      assignment(worker, 'headliner-bmw', 'RED', '2026-07-01', null),
    ];
    const corrections = headlinerCorrections();
    const days = createCalendarDays('2026-07');
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [
        department('headliner-bmw', 'Headliner BMW', 'THREE_SHIFT'),
      ],
      options: { assignments, departmentShiftCorrections: corrections },
    });
    const presentation = resolveEffectiveAssignmentPresentation({
      employee: worker,
      dates: days.map((day) => day.isoDate),
      assignments,
    });

    expect(presentation).toMatchObject({
      kind: 'STABLE',
      shiftAssignment: 'RED',
      hasMissingShift: false,
    });
    expect(schedule.find((day) => day.date === '2026-07-06')).toMatchObject({
      shiftAssignment: 'RED',
      shift: 'NIGHT',
      source: 'automatic',
    });
  });

  it('exposes a missing dated group while retaining the First-shift fallback', () => {
    const worker = employee({
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const assignments = [
      assignment(worker, 'headliner-bmw', null, '2026-07-01', null),
    ];
    const days = createCalendarDays('2026-07');
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [
        department('headliner-bmw', 'Headliner BMW', 'THREE_SHIFT'),
      ],
      options: {
        assignments,
        departmentShiftCorrections: headlinerCorrections(),
      },
    });
    const presentation = resolveEffectiveAssignmentPresentation({
      employee: worker,
      dates: days.map((day) => day.isoDate),
      assignments,
    });

    expect(presentation).toMatchObject({
      kind: 'MISSING_SHIFT',
      shiftAssignment: null,
      hasMissingShift: true,
    });
    expect(schedule.find((day) => day.date === '2026-07-06')).toMatchObject({
      shiftAssignment: null,
      shift: 'FIRST',
      source: 'automatic',
    });
  });

  it('keeps two effective Blue employees on the same corrected rotation', () => {
    const first = employee({
      id: 'employee-blue-1',
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const second = employee({
      id: 'employee-blue-2',
      tetaNumber: 'WT-002',
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const days = createCalendarDays('2026-07');
    const shifts = (worker: Employee) =>
      generateEmployeeMonthlySchedule({
        employee: worker,
        days,
        departments: [
          department('headliner-bmw', 'Headliner BMW', 'THREE_SHIFT'),
        ],
        options: { departmentShiftCorrections: headlinerCorrections() },
      }).map((day) => day.shift);

    expect(shifts(first)).toEqual(shifts(second));
  });

  it('keeps the Blue baseline equal and overrides only one employee-day', () => {
    const first = employee({
      id: 'employee-blue-1',
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const second = employee({
      id: 'employee-blue-2',
      tetaNumber: 'WT-002',
      departmentId: 'headliner-bmw',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-01-01'),
    });
    const days = createCalendarDays('2026-07');
    const options = { departmentShiftCorrections: headlinerCorrections() };
    const baseline = generateEmployeeMonthlySchedule({
      employee: second,
      days,
      departments: [
        department('headliner-bmw', 'Headliner BMW', 'THREE_SHIFT'),
      ],
      options,
    });
    const corrected = generateEmployeeMonthlySchedule({
      employee: first,
      days,
      departments: [
        department('headliner-bmw', 'Headliner BMW', 'THREE_SHIFT'),
      ],
      options: {
        ...options,
        corrections: [
          correction(first, '2026-07-13', 'NIGHT_SHIFT', 'NIGHT', 8),
        ],
      },
    });

    expect(corrected.find((day) => day.date === '2026-07-13')).toMatchObject({
      shift: 'NIGHT',
      shiftAssignment: 'BLUE',
      source: 'manual-correction',
    });
    const withoutEmployeeIdentity = (day: (typeof corrected)[number]) => ({
      ...day,
      employeeId: 'same-employee',
    });

    expect(
      corrected
        .filter((day) => day.date !== '2026-07-13')
        .map(withoutEmployeeIdentity),
    ).toEqual(
      baseline
        .filter((day) => day.date !== '2026-07-13')
        .map(withoutEmployeeIdentity),
    );
  });

  it('marks a Red-to-Blue change as variable and resolves each side', () => {
    const worker = employee({
      departmentId: 'headliner-bmw',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-01-01'),
    });
    const assignments = [
      assignment(worker, 'headliner-bmw', 'RED', '2026-07-01', '2026-07-19'),
      assignment(worker, 'headliner-bmw', 'BLUE', '2026-07-20', null),
    ];
    const days = createCalendarDays('2026-07');
    const presentation = resolveEffectiveAssignmentPresentation({
      employee: worker,
      dates: days.map((day) => day.isoDate),
      assignments,
    });

    expect(presentation.kind).toBe('VARIABLE');
    expect(
      resolveEffectiveAssignment(worker, '2026-07-13', assignments),
    ).toMatchObject({ shiftAssignment: 'RED' });
    expect(
      resolveEffectiveAssignment(worker, '2026-07-20', assignments),
    ).toMatchObject({ shiftAssignment: 'BLUE' });
  });

  it('uses the latest explicit version when legacy records share an effective date', () => {
    const worker = employee({
      departmentId: 'headliner-bmw',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-01-01'),
    });
    const older = {
      ...assignment(worker, 'headliner-bmw', 'RED', '2026-07-01', null),
      id: 'older',
      updatedAt: date('2026-07-01'),
    };
    const corrected = {
      ...assignment(worker, 'headliner-bmw', 'BLUE', '2026-07-01', null),
      id: 'corrected',
      updatedAt: date('2026-07-02'),
    };

    expect(
      resolveEffectiveAssignment(worker, '2026-07-15', [older, corrected]),
    ).toMatchObject({ assignmentId: 'corrected', shiftAssignment: 'BLUE' });
  });

  it('follows the exact Headliner correction sequence from 2026-07-06', () => {
    const headliner = department(
      'headliner-bmw',
      'Headliner BMW',
      'THREE_SHIFT',
    );
    const corrections = headlinerCorrections().slice(0, 1);
    const expected = {
      RED: ['NIGHT', 'SECOND', 'FIRST', 'NIGHT'],
      WHITE: ['SECOND', 'FIRST', 'NIGHT', 'SECOND'],
      BLUE: ['FIRST', 'NIGHT', 'SECOND', 'FIRST'],
    } as const;

    (Object.keys(expected) as Array<keyof typeof expected>).forEach((group) => {
      expect(
        ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'].map(
          (dateValue) =>
            resolveRotatingShift({
              department: headliner,
              shiftAssignment: group,
              date: dateValue,
              corrections,
            }),
        ),
      ).toEqual(expected[group]);
    });
  });

  it('marks first two working days from employment start as BHP and skips holidays', () => {
    const worker = employee({
      employmentStartDate: date('2026-06-04'),
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
      options: {
        publicHolidays: getPublicHolidaysForYear(2026),
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
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const corrections: ScheduleCorrection[] = [
      correction(worker, '2026-06-10', 'NIGHT_SHIFT', 'NIGHT', 8),
    ];
    const automaticSchedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
      options: { corrections },
    });

    expect(schedule.find((day) => day.date === '2026-06-10')).toMatchObject({
      source: 'manual-correction',
      label: '8 / N',
      shift: 'NIGHT',
    });
    expect(schedule.find((day) => day.date === '2026-06-09')).toEqual(
      automaticSchedule.find((day) => day.date === '2026-06-09'),
    );
    expect(schedule.find((day) => day.date === '2026-06-11')).toEqual(
      automaticSchedule.find((day) => day.date === '2026-06-11'),
    );
    expect(worker.shiftAssignment).toBe('RED');
  });

  it('ignores a cancelled correction and restores the automatic brigade plan', () => {
    const worker = employee({
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const automaticSchedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
    });
    const cancelled = {
      ...correction(worker, '2026-06-10', 'NIGHT_SHIFT', 'NIGHT', 8),
      status: 'CANCELLED' as const,
    };
    const restoredSchedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
      options: { corrections: [cancelled] },
    });

    expect(restoredSchedule.find((day) => day.date === '2026-06-10')).toEqual(
      automaticSchedule.find((day) => day.date === '2026-06-10'),
    );
  });

  it('ignores corrections belonging to another employee', () => {
    const worker = employee({
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const anotherWorker = employee({
      id: 'employee-2',
      tetaNumber: 'WT-002',
      departmentId: 'metal-402b',
      shiftAssignment: 'BLUE',
      employmentStartDate: date('2026-06-01'),
    });
    const days = createCalendarDays('2026-06', {
      publicHolidays: getPublicHolidaysForYear(2026),
    });
    const automaticSchedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days,
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
      options: {
        corrections: [
          correction(anotherWorker, '2026-06-10', 'NIGHT_SHIFT', 'NIGHT', 8),
        ],
      },
    });

    expect(schedule).toEqual(automaticSchedule);
  });

  it('does not produce blank relevant days', () => {
    const worker = employee({
      departmentId: 'metal-402b',
      shiftAssignment: 'RED',
      employmentStartDate: date('2026-06-01'),
    });
    const schedule = generateEmployeeMonthlySchedule({
      employee: worker,
      days: createCalendarDays('2026-06', {
        publicHolidays: getPublicHolidaysForYear(2026),
      }),
      departments: [department('metal-402b', 'Metal 402B', 'THREE_SHIFT')],
    });

    expect(hasNoBlankRelevantScheduleDays(schedule)).toBe(true);
  });
});

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function employee(overrides: Partial<Employee> = {}): Employee {
  const now = date('2026-06-01');
  const start = Object.hasOwn(overrides, 'employmentStartDate')
    ? (overrides.employmentStartDate ?? null)
    : now;
  const end = Object.hasOwn(overrides, 'employmentEndDate')
    ? (overrides.employmentEndDate ?? null)
    : null;
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
    employmentStartDate: start,
    employmentEndDate: end,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
    ...overrides,
    contracts:
      overrides.contracts ??
      (start
        ? [
            {
              id: 'contract-1',
              employeeId: overrides.id ?? 'employee-1',
              tetaNumber: overrides.tetaNumber ?? 'WT-001',
              sequenceId: 'sequence-1',
              startDate: start.toISOString().slice(0, 10),
              endDate: end?.toISOString().slice(0, 10) ?? null,
              status: 'ACTIVE',
              note: null,
              createdAt: now,
              createdBy: 'test',
              updatedAt: now,
              updatedBy: 'test',
            },
          ]
        : []),
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
  shiftAssignment: Employee['shiftAssignment'],
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

function headlinerCorrections(): DepartmentShiftCorrection[] {
  const now = date('2026-08-03');
  return [
    {
      id: 'headliner-bmw-2026-07-06',
      departmentId: 'headliner-bmw',
      effectiveDate: '2026-07-06',
      shiftMode: 'THREE_SHIFT',
      groupAssignments: {
        RED: 'NIGHT',
        WHITE: 'SECOND',
        BLUE: 'FIRST',
      },
      status: 'ACTIVE',
      note: null,
      createdAt: now,
      createdBy: 'test',
      updatedAt: now,
      updatedBy: 'test',
    },
    {
      id: 'headliner-bmw-2026-07-20',
      departmentId: 'headliner-bmw',
      effectiveDate: '2026-07-20',
      shiftMode: 'THREE_SHIFT',
      groupAssignments: {
        RED: 'FIRST',
        WHITE: 'NIGHT',
        BLUE: 'SECOND',
      },
      status: 'ACTIVE',
      note: null,
      createdAt: now,
      createdBy: 'test',
      updatedAt: now,
      updatedBy: 'test',
    },
  ];
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
    monthId: correctionDate.slice(0, 7),
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
