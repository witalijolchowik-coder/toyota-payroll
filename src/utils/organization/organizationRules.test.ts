import {
  allowedColorShiftsForMode,
  CANONICAL_DEPARTMENT_IDS,
  colorShiftLabelKey,
  departmentKeyFromName,
  isDepartmentShiftMode,
  isEmployeeColorShift,
  normalizeDepartmentName,
  resolveCanonicalDepartment,
  resolveWeeklyRotationAssignment,
} from './organizationRules';

describe('department and shift organization rules', () => {
  it('normalizes department names and stable keys', () => {
    expect(normalizeDepartmentName('  Montaż   PU  ')).toBe('Montaż PU');
    expect(departmentKeyFromName('Montaż PU')).toBe('montaz-pu');
    expect(departmentKeyFromName(' Szwalnia ')).toBe('szwalnia');
  });

  it('contains only canonical MVP departments', () => {
    expect(CANONICAL_DEPARTMENT_IDS).toEqual([
      'metal',
      'szwalnia',
      'montaz',
      'pu',
      'headliner',
      'magazyn',
    ]);
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('lakiernia');
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('pen');
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('podsufitki');
  });

  it.each([
    [' Metal ', 'metal'],
    ['szwalnia', 'szwalnia'],
    ['MONTAZ', 'montaz'],
    ['Montaż', 'montaz'],
    ['PU', 'pu'],
    ['Headliner', 'headliner'],
    ['magazyn', 'magazyn'],
  ])('safely resolves canonical department %s', (raw, expectedId) => {
    expect(resolveCanonicalDepartment(raw)).toMatchObject({
      status: 'matched',
      department: { id: expectedId },
    });
  });

  it('does not map NA0 or unknown departments automatically', () => {
    expect(resolveCanonicalDepartment('NA0')).toEqual({
      status: 'unresolved-na0',
    });
    expect(resolveCanonicalDepartment('Lakiernia')).toEqual({
      status: 'unknown',
    });
  });

  it('recognizes only supported employee color shifts', () => {
    expect(isEmployeeColorShift('RED')).toBe(true);
    expect(isEmployeeColorShift('WHITE')).toBe(true);
    expect(isEmployeeColorShift('BLUE')).toBe(true);
    expect(isEmployeeColorShift('FIRST')).toBe(false);
    expect(colorShiftLabelKey(null)).toBe('unassigned');
  });

  it('recognizes supported department shift modes', () => {
    expect(isDepartmentShiftMode('UNKNOWN')).toBe(true);
    expect(isDepartmentShiftMode('TWO_SHIFT')).toBe(true);
    expect(isDepartmentShiftMode('THREE_SHIFT')).toBe(true);
    expect(isDepartmentShiftMode('DAY_ONLY')).toBe(false);
  });

  it('limits Blue to three-shift departments', () => {
    expect(allowedColorShiftsForMode('TWO_SHIFT')).toEqual(['RED', 'WHITE']);
    expect(allowedColorShiftsForMode('THREE_SHIFT')).toEqual([
      'RED',
      'WHITE',
      'BLUE',
    ]);
    expect(allowedColorShiftsForMode('UNKNOWN')).toEqual([
      'RED',
      'WHITE',
      'BLUE',
    ]);
  });

  it('resolves only valid weekly rotation assignments for configured modes', () => {
    expect(
      resolveWeeklyRotationAssignment({
        departmentShiftMode: 'TWO_SHIFT',
        baseWeekStartIsoDate: '2026-07-06',
        direction: 'night-to-second-to-first-to-night',
        baseAssignment: {
          RED: 'FIRST',
          WHITE: 'SECOND',
          BLUE: 'NIGHT',
        },
      }),
    ).toEqual({
      RED: 'FIRST',
      WHITE: 'SECOND',
    });

    expect(
      resolveWeeklyRotationAssignment({
        departmentShiftMode: 'UNKNOWN',
        baseWeekStartIsoDate: '2026-07-06',
        direction: 'manual',
        baseAssignment: { RED: 'FIRST' },
      }),
    ).toEqual({});
  });
});
