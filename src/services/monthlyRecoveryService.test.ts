import { recoveryPointCreationDecision } from './monthlyRecoveryService';

describe('monthly recovery point schedule', () => {
  const now = new Date('2026-07-16T12:00:00.000Z');

  it('does not create a meaningless point for the same input hash', () => {
    expect(
      recoveryPointCreationDecision({
        latestInputHash: 'hash-1',
        latestCreatedAt: new Date('2026-07-16T08:00:00.000Z'),
        inputHash: 'hash-1',
        now,
        force: false,
      }),
    ).toBe('unchanged');
  });

  it('waits approximately two hours after a changed snapshot', () => {
    expect(
      recoveryPointCreationDecision({
        latestInputHash: 'hash-1',
        latestCreatedAt: new Date('2026-07-16T11:00:01.000Z'),
        inputHash: 'hash-2',
        now,
        force: false,
      }),
    ).toBe('not-due');
    expect(
      recoveryPointCreationDecision({
        latestInputHash: 'hash-1',
        latestCreatedAt: new Date('2026-07-16T10:00:00.000Z'),
        inputHash: 'hash-2',
        now,
        force: false,
      }),
    ).toBe('created');
  });

  it('allows a deliberate point for changed inputs without waiting', () => {
    expect(
      recoveryPointCreationDecision({
        latestInputHash: 'hash-1',
        latestCreatedAt: new Date('2026-07-16T11:59:00.000Z'),
        inputHash: 'hash-2',
        now,
        force: true,
      }),
    ).toBe('created');
  });
});
