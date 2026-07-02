import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createSettlementMonth,
  loadSettlementMonth,
  SettlementServiceError,
  type SettlementMonthData,
} from '../../services/settlementService';
import type { MonthId } from '../../types/firestore';

interface SettlementMonthState {
  data: SettlementMonthData | null;
  error: Error | null;
  isLoading: boolean;
  isCreating: boolean;
}

const initialState: SettlementMonthState = {
  data: null,
  error: null,
  isLoading: true,
  isCreating: false,
};

export function useSettlementMonth(monthId: MonthId) {
  const [state, setState] = useState<SettlementMonthState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  useEffect(() => {
    let cancelled = false;
    showLoading();

    void loadSettlementMonth(monthId)
      .then((data) => {
        if (!cancelled) {
          setState({
            data,
            error: null,
            isLoading: false,
            isCreating: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            isLoading: false,
            isCreating: false,
          });
        }
      })
      .finally(hideLoading);

    return () => {
      cancelled = true;
    };
  }, [hideLoading, monthId, showLoading]);

  const createMonth = useCallback(async () => {
    setState((current) => ({
      ...current,
      error: null,
      isCreating: true,
    }));
    showLoading();

    try {
      await createSettlementMonth(monthId);
      const data = await loadSettlementMonth(monthId);
      if (!data) {
        throw new SettlementServiceError('month-unavailable');
      }
      setState({
        data,
        error: null,
        isLoading: false,
        isCreating: false,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error : new Error(String(error)),
        isCreating: false,
      }));
      throw error;
    } finally {
      hideLoading();
    }
  }, [hideLoading, monthId, showLoading]);

  return { ...state, createMonth };
}
