import { describe, expect, it } from 'vitest';

import {
  canonicalDepartmentsFallback,
  canonicalDepartmentsToSeed,
  normalizeDepartmentInput,
} from './departmentsService';

describe('departmentsService', () => {
  it('preserves an explicitly selected shift mode for a canonical department', () => {
    expect(
      normalizeDepartmentInput({
        id: 'headliner-bmw',
        name: 'Headliner BMW',
        shiftMode: 'THREE_SHIFT',
        active: true,
      }),
    ).toMatchObject({
      id: 'headliner-bmw',
      name: 'Headliner BMW',
      shiftMode: 'THREE_SHIFT',
    });
  });

  it('keeps canonical defaults only as fallback values', () => {
    const fallback = canonicalDepartmentsFallback().find(
      (department) => department.id === 'headliner-bmw',
    );

    expect(fallback?.shiftMode).toBe('TWO_SHIFT');
  });

  it('never seeds over an existing department with an edited shift mode', () => {
    const departmentsToSeed = canonicalDepartmentsToSeed(
      new Set(['headliner-bmw', 'pu-toyota']),
    );

    expect(
      departmentsToSeed.some((department) => department.id === 'headliner-bmw'),
    ).toBe(false);
    expect(
      departmentsToSeed.some((department) => department.id === 'pu-toyota'),
    ).toBe(false);
    expect(
      departmentsToSeed.some(
        (department) => department.id === 'szwalnia-toyota',
      ),
    ).toBe(true);
  });
});
