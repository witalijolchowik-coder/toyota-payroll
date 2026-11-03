import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PayrollMonth } from '../../types/firestore';
import type { SettlementExportPackage } from '../../utils/reports';
import { persistMonthlyCalculation } from '../../services/monthlyCalculationService';
import { MonthlyCalculationStatusPanel } from './MonthlyCalculationStatusPanel';

vi.mock('../../services/monthlyCalculationService', async (load) => ({
  ...(await load<typeof import('../../services/monthlyCalculationService')>()),
  persistMonthlyCalculation: vi.fn(async () => 'unchanged'),
}));
vi.mock('../../services/monthlyRecoveryService', () => ({
  listMonthlyRecoveryPoints: vi.fn(async () => []),
  ensureMonthlyRecoveryPoint: vi.fn(async () => {}),
  restoreMonthlyRecoveryPoint: vi.fn(),
}));
vi.mock('../../services/settlementVersionService', () => ({
  listSettlementVersions: vi.fn(async () => []),
  closeSettlementMonth: vi.fn(),
  loadClosedSettlementVersion: vi.fn(),
  reopenSettlementMonth: vi.fn(),
}));
const month: PayrollMonth = {
  id: '2026-10',
  year: 2026,
  month: 10,
  monthStart: new Date('2026-10-01'),
  monthEnd: new Date('2026-10-31'),
  isSettled: false,
  calculationStatus: 'completed',
  calculationStartedAt: null,
  calculationCompletedAt: null,
  calculationVersion: 1,
  calculationError: null,
  calculationInputHash: 'old-historical-input',
  calculationRunId: null,
  calculationBlockerCount: 0,
  calculationWarningCount: 0,
  settledAt: null,
  settledBy: null,
  settlementVersionNumber: 0,
  currentSettlementVersionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test',
  updatedBy: 'test',
};
const props = {
  monthId: month.id,
  month,
  drafts: [],
  inputHash: 'new-plan',
  employeeCount: 1,
  monthLabel: 'październik 2026',
  onReload: vi.fn(async () => {}),
  finalExportPackage: { warnings: [] } as unknown as SettlementExportPackage,
};
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
describe('brigade calculation persistence protection', () => {
  it('never auto-persists changed historical results in manual-only mode', async () => {
    vi.useFakeTimers();
    render(
      <MonthlyCalculationStatusPanel {...props} manualRecalculationOnly />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(persistMonthlyCalculation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Przelicz miesiąc' }));
    await act(async () => {});
    expect(persistMonthlyCalculation).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });
  it('blocks both automatic and explicit recalculation with missing brigade plans', async () => {
    vi.useFakeTimers();
    render(
      <MonthlyCalculationStatusPanel {...props} calculationAllowed={false} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(persistMonthlyCalculation).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Przelicz miesiąc' }),
    ).toBeDisabled();
  });
  it('retains existing automatic persistence for non-brigade months', async () => {
    vi.useFakeTimers();
    render(<MonthlyCalculationStatusPanel {...props} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(persistMonthlyCalculation).toHaveBeenCalledOnce();
  });
});
