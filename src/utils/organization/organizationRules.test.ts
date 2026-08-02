import {
  allowedColorShiftsForMode,
  CANONICAL_DEPARTMENT_IDS,
  CANONICAL_DEPARTMENTS,
  canonicalDepartmentFunctionalGroup,
  canonicalDepartmentOfficialName,
  canonicalDepartmentUiName,
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

  it('contains exactly the seven final canonical departments with stable unique IDs', () => {
    expect(CANONICAL_DEPARTMENT_IDS).toEqual([
      'montaz-toyota',
      'headliner-bmw',
      'pu-toyota',
      'szwalnia-toyota',
      'metal-402b',
      'metal-936b',
      'magazyn',
    ]);
    expect(new Set(CANONICAL_DEPARTMENT_IDS).size).toBe(7);
    expect(CANONICAL_DEPARTMENTS).toHaveLength(7);
    CANONICAL_DEPARTMENTS.forEach((department) => {
      expect(department.officialName).toBeTruthy();
      expect(department.uiName).toBeTruthy();
      expect(department.functionalGroup).toBeTruthy();
    });
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('lakiernia');
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('pen');
    expect(CANONICAL_DEPARTMENT_IDS).not.toContain('podsufitki');
  });

  it.each([
    ['MFG Toyota Metal 402B', 'metal-402b'],
    ['Metal 936B', 'metal-936b'],
    ['szwalnia', 'szwalnia-toyota'],
    ['MONTAZ', 'montaz-toyota'],
    ['Montaż Toyota', 'montaz-toyota'],
    ['PU', 'pu-toyota'],
    ['Headliner', 'headliner-bmw'],
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
    expect(resolveCanonicalDepartment('Metal')).toEqual({
      status: 'ambiguous-legacy-metal',
    });
    expect(resolveCanonicalDepartment('Nowy projekt')).toEqual({
      status: 'unknown',
    });
  });

  it('separates UI, official and functional names without merging Metal lines', () => {
    expect(canonicalDepartmentUiName('metal-402b')).toBe('Metal 402B');
    expect(canonicalDepartmentOfficialName('metal-402b')).toBe(
      'MFG Toyota Metal 402B',
    );
    expect(canonicalDepartmentFunctionalGroup('metal-402b')).toBe('METAL');
    expect(canonicalDepartmentFunctionalGroup('metal-936b')).toBe('METAL');
    expect(canonicalDepartmentUiName('metal-936b')).toBe('Metal 936B');
    expect(canonicalDepartmentUiName('metal-402b')).not.toBe(
      canonicalDepartmentUiName('metal-936b'),
    );
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
