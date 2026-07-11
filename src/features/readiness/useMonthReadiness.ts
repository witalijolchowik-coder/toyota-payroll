import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import { loadMonthReadiness } from '../../services/readinessService';
import type { MonthId } from '../../types/firestore';
import type { MonthReadinessSummary } from '../../utils/readiness';

interface MonthReadinessState {
  data: MonthReadinessSummary | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMonthReadiness(monthId: MonthId) {
  const [state, setState] = useState<MonthReadinessState>({
    data: null,
    isLoading: true,
    error: null,
  });
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    showLoading();
    try {
      const data = await loadMonthReadiness(monthId);
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    } finally {
      hideLoading();
    }
  }, [hideLoading, monthId, showLoading]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  return { ...state, reload };
}
