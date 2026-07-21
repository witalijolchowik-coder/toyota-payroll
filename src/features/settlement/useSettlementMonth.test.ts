import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  loadSettlementMonth: vi.fn(),
  createSettlementMonth: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
}));

vi.mock('../../hooks/useGlobalLoading', () => ({
  useGlobalLoading: () => ({
    showLoading: mocks.showLoading,
    hideLoading: mocks.hideLoading,
  }),
}));

vi.mock('../../services/settlementService', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../services/settlementService')
  >()),
  loadSettlementMonth: mocks.loadSettlementMonth,
  createSettlementMonth: mocks.createSettlementMonth,
}));

import { SettlementServiceError } from '../../services/settlementService';
import { useSettlementMonth } from './useSettlementMonth';

describe('useSettlementMonth contract-history loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the page loading while contract history is being read', async () => {
    let resolveLoad!: (value: null) => void;
    const pending = new Promise<null>((resolve) => {
      resolveLoad = resolve;
    });
    mocks.loadSettlementMonth.mockImplementation(
      (_monthId, options: { onLoadingStage?: (stage: string) => void }) => {
        options.onLoadingStage?.('contracts');
        return pending;
      },
    );

    const { result } = renderHook(() => useSettlementMonth('2026-06'));

    await waitFor(() => expect(result.current.loadingStage).toBe('contracts'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => resolveLoad(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns an explicit contract-history error instead of an empty result', async () => {
    mocks.loadSettlementMonth.mockImplementation(
      (_monthId, options: { onLoadingStage?: (stage: string) => void }) => {
        options.onLoadingStage?.('contracts');
        return Promise.reject(
          new SettlementServiceError('contract-history-unavailable'),
        );
      },
    );

    const { result } = renderHook(() => useSettlementMonth('2026-06'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(SettlementServiceError);
    expect((result.current.error as SettlementServiceError).code).toBe(
      'contract-history-unavailable',
    );
  });
});
