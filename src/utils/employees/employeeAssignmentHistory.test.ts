import { describe, expect, it } from 'vitest';

import type { EmployeeAssignment } from '../../types/firestore';
import {
  isAssignmentDateOnOrAfterEmploymentStart,
  planEmployeeAssignmentTransition,
} from './employeeAssignmentHistory';

function assignment(
  id: string,
  group: EmployeeAssignment['shiftAssignment'],
  validFrom: string,
  validTo: string | null = null,
  updatedAt = '2026-07-01T08:00:00.000Z',
): EmployeeAssignment {
  return {
    id,
    employeeId: 'employee-1',
    tetaNumber: 'WT-1',
    departmentId: 'headliner-bmw',
    shiftAssignment: group,
    validFrom,
    validTo,
    status: 'ACTIVE',
    note: null,
    createdAt: new Date(updatedAt),
    createdBy: 'admin',
    updatedAt: new Date(updatedAt),
    updatedBy: 'admin',
  };
}

describe('employee assignment history transition', () => {
  it('accepts the first employment day and rejects an earlier assignment', () => {
    const contracts = [{ startDate: '2026-07-01', status: 'ACTIVE' as const }];
    expect(
      isAssignmentDateOnOrAfterEmploymentStart(contracts, '2026-07-01'),
    ).toBe(true);
    expect(
      isAssignmentDateOnOrAfterEmploymentStart(contracts, '2026-06-30'),
    ).toBe(false);
  });

  it('replaces a wrong same-date group without deleting history', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [assignment('red', 'RED', '2026-07-01')],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: 'BLUE',
        validFrom: '2026-07-01',
      },
      today: '2026-07-10',
    });

    expect(plan.create).toMatchObject({
      shiftAssignment: 'BLUE',
      validTo: null,
    });
    expect(plan.updates).toEqual([
      { assignmentId: 'red', validTo: null, status: 'CANCELLED' },
    ]);
    expect(plan.effectiveToday?.shiftAssignment).toBe('BLUE');
  });

  it('ends the previous period and preserves a planned future assignment', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [
        assignment('red', 'RED', '2026-07-01'),
        assignment('white', 'WHITE', '2026-08-01'),
      ],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: 'BLUE',
        validFrom: '2026-07-15',
      },
      today: '2026-07-20',
    });

    expect(plan.updates).toContainEqual({
      assignmentId: 'red',
      validTo: '2026-07-14',
      status: 'ACTIVE',
    });
    expect(plan.create).toMatchObject({
      shiftAssignment: 'BLUE',
      validTo: '2026-07-31',
    });
    expect(plan.updates.some((item) => item.assignmentId === 'white')).toBe(
      false,
    );
  });

  it('supports an intentional no-group assignment', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [assignment('blue', 'BLUE', '2026-07-01')],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: null,
        validFrom: '2026-07-10',
      },
      today: '2026-07-10',
    });

    expect(plan.create?.shiftAssignment).toBeNull();
    expect(plan.effectiveToday?.shiftAssignment).toBeNull();
  });

  it('is idempotent when the selected assignment is already authoritative', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [assignment('blue', 'BLUE', '2026-07-01')],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: 'BLUE',
        validFrom: '2026-07-15',
      },
      today: '2026-07-15',
    });

    expect(plan.create).toBeNull();
    expect(plan.updates).toEqual([]);
  });

  it('cancels older same-date future duplicates using latest modification', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [
        assignment('current', 'RED', '2026-07-01'),
        assignment(
          'future-old',
          'WHITE',
          '2026-08-01',
          null,
          '2026-07-01T08:00:00Z',
        ),
        assignment(
          'future-new',
          'BLUE',
          '2026-08-01',
          null,
          '2026-07-02T08:00:00Z',
        ),
      ],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: 'RED',
        validFrom: '2026-07-15',
      },
      today: '2026-07-15',
    });

    expect(plan.updates).toContainEqual({
      assignmentId: 'future-old',
      validTo: null,
      status: 'CANCELLED',
    });
    expect(
      plan.updates.some((item) => item.assignmentId === 'future-new'),
    ).toBe(false);
  });

  it('normalizes overlapping future periods without removing the future plan', () => {
    const plan = planEmployeeAssignmentTransition({
      assignments: [
        assignment('current', 'RED', '2026-07-01'),
        assignment('august', 'WHITE', '2026-08-01'),
        assignment('september', 'BLUE', '2026-09-01'),
      ],
      selection: {
        departmentId: 'headliner-bmw',
        shiftAssignment: 'RED',
        validFrom: '2026-07-15',
      },
      today: '2026-07-15',
    });

    expect(plan.updates).toContainEqual({
      assignmentId: 'current',
      validTo: '2026-07-31',
      status: 'ACTIVE',
    });
    expect(plan.updates).toContainEqual({
      assignmentId: 'august',
      validTo: '2026-08-31',
      status: 'ACTIVE',
    });
    expect(plan.updates.some((item) => item.assignmentId === 'september')).toBe(
      false,
    );
  });
});
