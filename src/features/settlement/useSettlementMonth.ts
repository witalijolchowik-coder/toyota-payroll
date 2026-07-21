import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createSettlementMonth,
  loadSettlementMonth,
  SettlementServiceError,
  type SettlementLoadingStage,
  type SettlementMonthData,
} from '../../services/settlementService';
import type { MonthId } from '../../types/firestore';

interface SettlementMonthState {
  data: SettlementMonthData | null;
  error: Error | null;
  isLoading: boolean;
  loadingStage: SettlementLoadingStage | null;
  isCreating: boolean;
}

const initialState: SettlementMonthState = {
  data: null,
  error: null,
  isLoading: true,
  loadingStage: 'month',
  isCreating: false,
};

export function useSettlementMonth(monthId: MonthId) {
  const [state, setState] = useState<SettlementMonthState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  useEffect(() => {
    let cancelled = false;
    showLoading();
    setState({
      data: null,
      error: null,
      isLoading: true,
      loadingStage: 'month',
      isCreating: false,
    });

    void loadSettlementMonth(monthId, {
      onLoadingStage: (loadingStage) => {
        if (!cancelled) {
          setState((current) => ({ ...current, loadingStage }));
        }
      },
    })
      .then((data) => {
        if (!cancelled) {
          setState({
            data,
            error: null,
            isLoading: false,
            loadingStage: null,
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
            loadingStage: null,
            isCreating: false,
          });
        }
      })
      .finally(hideLoading);

    return () => {
      cancelled = true;
    };
  }, [hideLoading, monthId, showLoading]);

  const reload = useCallback(async () => {
    showLoading();
    setState((current) => ({
      ...current,
      error: null,
      isLoading: true,
      loadingStage: 'month',
    }));
    try {
      const data = await loadSettlementMonth(monthId, {
        onLoadingStage: (loadingStage) => {
          setState((current) => ({ ...current, loadingStage }));
        },
      });
      setState({
        data,
        error: null,
        isLoading: false,
        loadingStage: null,
        isCreating: false,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        loadingStage: null,
      }));
      throw error;
    } finally {
      hideLoading();
    }
  }, [hideLoading, monthId, showLoading]);

  const createMonth = useCallback(async () => {
    setState((current) => ({
      ...current,
      error: null,
      isCreating: true,
      loadingStage: 'month',
    }));
    showLoading();

    try {
      await createSettlementMonth(monthId);
      const data = await loadSettlementMonth(monthId, {
        onLoadingStage: (loadingStage) => {
          setState((current) => ({ ...current, loadingStage }));
        },
      });
      if (!data) {
        throw new SettlementServiceError('month-unavailable');
      }
      setState({
        data,
        error: null,
        isLoading: false,
        loadingStage: null,
        isCreating: false,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false,
        loadingStage: null,
        isCreating: false,
      }));
      throw error;
    } finally {
      hideLoading();
    }
  }, [hideLoading, monthId, showLoading]);

  return { ...state, createMonth, reload };
}
