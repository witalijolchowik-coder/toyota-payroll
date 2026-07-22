import { describe, expect, it } from 'vitest';

import type {
  EmployeeContract,
  EmploymentEndEvent,
} from '../../types/firestore';
import {
  calculateEmploymentLimit,
  contractBreakDays,
  employeeContractHistoryRevision,
  employeeContractsOverlapRange,
  isDateCoveredByContracts,
  isRangeFullyCoveredByContracts,
  isEmployeeArchived,
  mergeEmploymentCoverage,
  planLegacyContractMigration,
  requiresContractDecision,
  resolveCurrentContract,
  resolveFutureContract,
  validateEmployeeContract,
} from './employeeContracts';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'tester',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'tester',
};

function contract(
  id: string,
  startDate: string,
  endDate: string | null,
  sequenceId = 'sequence-1',
): EmployeeContract {
  return {
    id,
    employeeId: 'employee-1',
    tetaNumber: 'WT-1',
    sequenceId,
    startDate,
    endDate,
    status: 'ACTIVE',
    note: null,
    ...metadata,
  };
}

function endEvent(sequenceId: string, endDate: string): EmploymentEndEvent {
  return {
    id: `end-${sequenceId}`,
    employeeId: 'employee-1',
    tetaNumber: 'WT-1',
    sequenceId,
    endDate,
    status: 'ACTIVE',
    reason: null,
    ...metadata,
  };
}

function employee(
  contracts: EmployeeContract[],
  employmentEndEvents: EmploymentEndEvent[] = [],
) {
  return {
    contracts,
    employmentEndEvents,
    employmentStartDate: null,
    employmentEndDate: null,
  };
}

describe('employee contract history', () => {
  it('accepts a continuation and a real gap but rejects invalid, duplicate and overlapping ranges', () => {
    const existing = [contract('first', '2026-06-02', '2026-07-02')];

    expect(
      validateEmployeeContract(
        contract('next', '2026-07-03', '2026-09-30'),
        existing,
      ),
    ).toEqual([]);
    expect(
      validateEmployeeContract(contract('gap', '2026-09-01', '2026-09-30'), [
        contract('old', '2026-01-01', '2026-02-28'),
      ]),
    ).toEqual([]);
    expect(
      validateEmployeeContract(
        contract('invalid', '2026-07-10', '2026-07-01'),
        existing,
      )[0]?.code,
    ).toBe('invalid-range');
    expect(
      validateEmployeeContract(
        contract('duplicate', '2026-06-02', '2026-07-02'),
        existing,
      )[0]?.code,
    ).toBe('duplicate');
    expect(
      validateEmployeeContract(
        contract('overlap', '2026-07-02', '2026-08-01'),
        existing,
      )[0]?.code,
    ).toBe('overlap');
  });

  it('changes the canonical revision after edit, create or cancellation and ignores cancelled overlaps', () => {
    const openEnded = employee([contract('legacy', '2026-04-24', null)]);
    const edited = employee([contract('legacy', '2026-04-24', '2026-05-31')]);
    const created = employee([
      contract('legacy', '2026-04-24', '2026-05-31'),
      contract('next', '2026-06-01', '2026-08-31'),
    ]);
    const cancelled = employee([
      contract('legacy', '2026-04-24', '2026-05-31'),
      { ...contract('next', '2026-06-01', '2026-08-31'), status: 'CANCELLED' },
    ]);

    expect(employeeContractHistoryRevision(openEnded)).not.toBe(
      employeeContractHistoryRevision(edited),
    );
    expect(employeeContractHistoryRevision(edited)).not.toBe(
      employeeContractHistoryRevision(created),
    );
    expect(employeeContractHistoryRevision(created)).not.toBe(
      employeeContractHistoryRevision(cancelled),
    );
    expect(
      validateEmployeeContract(
        contract('replacement', '2026-06-01', '2026-08-31'),
        cancelled.contracts,
      ),
    ).toEqual([]);
  });

  it('resolves the contract covering today and keeps a future continuation separate', () => {
    const value = employee([
      contract('current', '2026-06-01', '2026-07-31'),
      contract('future', '2026-08-01', '2026-10-31'),
    ]);

    expect(
      resolveCurrentContract(value, new Date('2026-07-20T00:00:00.000Z'))?.id,
    ).toBe('current');
    expect(
      resolveFutureContract(value, new Date('2026-07-20T00:00:00.000Z'))?.id,
    ).toBe('future');
  });

  it('merges continuous coverage without duplicating days and preserves a gap', () => {
    const contracts = [
      contract('one', '2026-07-01', '2026-07-10'),
      contract('two', '2026-07-11', '2026-07-15'),
      contract('three', '2026-07-20', '2026-07-31'),
    ];

    expect(mergeEmploymentCoverage(contracts)).toEqual([
      { startDate: '2026-07-01', endDate: '2026-07-15' },
      { startDate: '2026-07-20', endDate: '2026-07-31' },
    ]);
    expect(contractBreakDays(contracts[1]!, contracts[2]!)).toBe(4);
  });

  it('uses the union of historical contracts for monthly and daily participation', () => {
    const value = employee([
      contract('june', '2026-06-02', '2026-07-02'),
      contract('july', '2026-07-10', '2026-07-31'),
    ]);

    expect(
      employeeContractsOverlapRange(value, '2026-06-01', '2026-06-30'),
    ).toBe(true);
    expect(isDateCoveredByContracts(value, '2026-07-05')).toBe(false);
    expect(isDateCoveredByContracts(value, '2026-07-20')).toBe(true);
    expect(
      employeeContractsOverlapRange(value, '2026-08-01', '2026-08-31'),
    ).toBe(false);
  });

  it('treats next-day contracts as continuous coverage and preserves a real gap', () => {
    const continuous = employee([
      contract('first', '2026-06-01', '2026-06-15'),
      contract('second', '2026-06-16', '2026-06-30'),
    ]);
    const withGap = employee([
      contract('first', '2026-06-01', '2026-06-15'),
      contract('second', '2026-06-17', '2026-06-30'),
    ]);

    expect(
      isRangeFullyCoveredByContracts(continuous, '2026-06-01', '2026-06-30'),
    ).toBe(true);
    expect(
      isRangeFullyCoveredByContracts(withGap, '2026-06-01', '2026-06-30'),
    ).toBe(false);
  });

  it('does not archive on expiry alone and resolves the decision after explicit ending', () => {
    const expired = employee([contract('ended', '2026-06-01', '2026-06-30')]);
    const today = new Date('2026-07-02T00:00:00.000Z');

    expect(requiresContractDecision(expired, today)).toBe(true);
    expect(isEmployeeArchived(expired, today)).toBe(false);

    const closed = employee(expired.contracts, [
      endEvent('sequence-1', '2026-06-30'),
    ]);
    expect(requiresContractDecision(closed, today)).toBe(false);
    expect(isEmployeeArchived(closed, today)).toBe(true);
  });

  it('does not keep a returning employee archived after a new sequence starts', () => {
    const returned = employee(
      [
        contract('old', '2025-01-01', '2025-06-30', 'old-sequence'),
        contract('return', '2026-07-01', null, 'new-sequence'),
      ],
      [endEvent('old-sequence', '2025-06-30')],
    );

    expect(
      isEmployeeArchived(returned, new Date('2026-07-20T00:00:00.000Z')),
    ).toBe(false);
  });

  it.each(['BARTŁOMIEJ PASZKO', 'KACPER KUŚMIERCZYK'])(
    'repairs a generic legacy auto-archive without fabricating an end event: %s',
    () => {
      const plan = planLegacyContractMigration({
        id: 'legacy-employee',
        contracts: [],
        employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
        employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
        employmentEndEvents: [],
        isActive: false,
      });

      expect(plan).toEqual({
        contractId: 'legacy-legacy-employee',
        sequenceId: 'legacy-legacy-employee',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        restoreOperationalActive: true,
      });
      expect(
        planLegacyContractMigration({
          id: 'legacy-employee',
          contracts: [contract('already-migrated', '2026-01-01', '2026-06-30')],
          employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
          employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
          employmentEndEvents: [],
          isActive: true,
        }),
      ).toBeNull();
    },
  );

  it('preserves an explicit archived sequence during legacy migration', () => {
    const plan = planLegacyContractMigration({
      id: 'closed',
      contracts: [],
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      employmentEndDate: new Date('2026-06-30T00:00:00.000Z'),
      employmentEndEvents: [endEvent('explicit-sequence', '2026-06-30')],
      isActive: false,
    });

    expect(plan?.sequenceId).toBe('explicit-sequence');
    expect(plan?.restoreOperationalActive).toBe(false);
  });
});

describe('cumulative 18-month employment limit', () => {
  it('counts an open current contract and projects the calendar-accurate continuous limit', () => {
    const result = calculateEmploymentLimit(
      employee([contract('open', '2026-01-31', null)]),
      new Date('2026-02-28T00:00:00.000Z'),
    );

    expect(result.usedDays).toBe(29);
    expect(result.projectedLimitDate).toBe('2027-07-31');
  });

  it('does not consume a six-month break and continues the existing cycle', () => {
    const result = calculateEmploymentLimit(
      employee([
        contract('first', '2025-01-01', '2025-02-28'),
        contract('second', '2025-09-01', null),
      ]),
      new Date('2025-09-30T00:00:00.000Z'),
    );

    expect(result.cycleStart).toBe('2025-01-01');
    expect(result.usedDays).toBe(89);
  });

  it('does not reset one day early and resets after exactly eighteen months without employment', () => {
    const previous = contract('old', '2024-01-01', '2025-01-31');
    const underThreshold = calculateEmploymentLimit(
      employee([previous, contract('early', '2026-07-31', null, 'sequence-2')]),
      new Date('2026-08-01T00:00:00.000Z'),
    );
    const exactThreshold = calculateEmploymentLimit(
      employee([previous, contract('reset', '2026-08-01', null, 'sequence-2')]),
      new Date('2026-08-01T00:00:00.000Z'),
    );

    expect(underThreshold.cycleStart).toBe('2024-01-01');
    expect(exactThreshold.cycleStart).toBe('2026-08-01');
    expect(exactThreshold.usedDays).toBe(1);
    expect(exactThreshold.projectedLimitDate).toBe('2028-02-01');
  });
});
