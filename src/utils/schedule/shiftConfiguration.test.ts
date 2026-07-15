import type {
  DepartmentShiftCorrection,
  ShiftHoursVersion,
} from '../../types/firestore';
import {
  DEFAULT_SHIFT_HOURS,
  previewDepartmentRotation,
  resolveDepartmentRotationShift,
  resolveDepartmentShiftCorrection,
  resolveShiftInterval,
  rotateShiftForWeek,
  validateDepartmentShiftCorrection,
  validateShiftHours,
} from './shiftConfiguration';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'admin',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  updatedBy: 'admin',
};

function correction(
  overrides: Partial<DepartmentShiftCorrection> = {},
): DepartmentShiftCorrection {
  return {
    id: 'metal-2026-06-08',
    departmentId: 'metal',
    effectiveDate: '2026-06-08',
    shiftMode: 'THREE_SHIFT',
    groupAssignments: { RED: 'FIRST', WHITE: 'NIGHT', BLUE: 'SECOND' },
    status: 'ACTIVE',
    note: null,
    ...metadata,
    ...overrides,
  };
}

describe('effective shift hours', () => {
  it('provides the standard 1, 2 and overnight N intervals', () => {
    expect(DEFAULT_SHIFT_HOURS.FIRST).toEqual({
      startTime: '06:00',
      endTime: '14:00',
    });
    expect(DEFAULT_SHIFT_HOURS.SECOND).toEqual({
      startTime: '14:00',
      endTime: '22:00',
    });
    expect(DEFAULT_SHIFT_HOURS.NIGHT).toEqual({
      startTime: '22:00',
      endTime: '06:00',
    });
    expect(validateShiftHours(DEFAULT_SHIFT_HOURS)).toBe(true);
  });

  it('uses the newest effective version without changing historical dates', () => {
    const versions: ShiftHoursVersion[] = [
      {
        id: 'old',
        validFrom: '2026-01-01',
        intervals: DEFAULT_SHIFT_HOURS,
        active: true,
        note: null,
        ...metadata,
      },
      {
        id: 'new',
        validFrom: '2026-07-01',
        intervals: {
          ...DEFAULT_SHIFT_HOURS,
          FIRST: { startTime: '05:30', endTime: '13:30' },
        },
        active: true,
        note: null,
        ...metadata,
      },
    ];
    expect(
      resolveShiftInterval('FIRST', '2026-06-30', versions).startTime,
    ).toBe('06:00');
    expect(
      resolveShiftInterval('FIRST', '2026-07-01', versions).startTime,
    ).toBe('05:30');
  });
});

describe('department-local shift corrections', () => {
  it('validates unique three-shift and two-shift mappings', () => {
    expect(validateDepartmentShiftCorrection(correction())).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      validateDepartmentShiftCorrection({
        shiftMode: 'THREE_SHIFT',
        groupAssignments: { RED: 'FIRST', WHITE: 'FIRST', BLUE: 'NIGHT' },
      }).errors,
    ).toContain('duplicate-shift');
    expect(
      validateDepartmentShiftCorrection({
        shiftMode: 'TWO_SHIFT',
        groupAssignments: { RED: 'FIRST', WHITE: 'SECOND', BLUE: 'NIGHT' },
      }).errors,
    ).toContain('blue-not-allowed');
  });

  it('rotates three shifts forward and backward as 1 → N → 2 → 1', () => {
    expect(rotateShiftForWeek('FIRST', 1, 'THREE_SHIFT')).toBe('NIGHT');
    expect(rotateShiftForWeek('NIGHT', 1, 'THREE_SHIFT')).toBe('SECOND');
    expect(rotateShiftForWeek('SECOND', 1, 'THREE_SHIFT')).toBe('FIRST');
    expect(rotateShiftForWeek('FIRST', -1, 'THREE_SHIFT')).toBe('SECOND');
  });

  it('alternates two shifts and never generates a night shift', () => {
    expect(rotateShiftForWeek('FIRST', 1, 'TWO_SHIFT')).toBe('SECOND');
    expect(rotateShiftForWeek('SECOND', 1, 'TWO_SHIFT')).toBe('FIRST');
    expect(rotateShiftForWeek('NIGHT', 1, 'TWO_SHIFT')).toBeNull();
  });

  it('uses the nearest correction and keeps departments independent', () => {
    const corrections = [
      correction(),
      correction({
        id: 'later',
        effectiveDate: '2026-07-06',
        groupAssignments: { RED: 'SECOND', WHITE: 'FIRST', BLUE: 'NIGHT' },
      }),
      correction({
        id: 'sewing',
        departmentId: 'szwalnia',
        shiftMode: 'TWO_SHIFT',
        groupAssignments: { RED: 'SECOND', WHITE: 'FIRST' },
      }),
    ];
    expect(
      resolveDepartmentShiftCorrection(corrections, 'metal', '2026-07-05')?.id,
    ).toBe('metal-2026-06-08');
    expect(
      resolveDepartmentShiftCorrection(corrections, 'metal', '2026-07-06')?.id,
    ).toBe('later');
    expect(
      resolveDepartmentRotationShift({
        departmentId: 'metal',
        shiftAssignment: 'RED',
        date: '2026-06-08',
        corrections,
      }),
    ).toBe('FIRST');
    expect(
      resolveDepartmentRotationShift({
        departmentId: 'szwalnia',
        shiftAssignment: 'RED',
        date: '2026-06-08',
        corrections,
      }),
    ).toBe('SECOND');
  });

  it('previews the previous, selected and future ISO weeks', () => {
    const preview = previewDepartmentRotation(correction(), 1, 2);
    expect(preview.map((week) => week.weekStart)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
    ]);
    expect(preview.find((week) => week.selected)?.assignments.RED).toBe(
      'FIRST',
    );
  });
});
