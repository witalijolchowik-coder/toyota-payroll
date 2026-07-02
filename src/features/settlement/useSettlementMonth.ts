import { useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  loadOrCreateSettlementMonth,
  type SettlementMonthData,
} from '../../services/settlementService';
import type { MonthId } from '../../types/firestore';

interface SettlementMonthState {
  data: SettlementMonthData | null;
  error: Error | null;
  isLoading: boolean;
}

const initialState: SettlementMonthState = {
  data: null,
  error: null,
  isLoading: true,
};

export function useSettlementMonth(monthId: MonthId) {
  const [state, setState] = useState<SettlementMonthState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  useEffect(() => {
    let cancelled = false;
    showLoading();

    void loadOrCreateSettlementMonth(monthId)
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
            isLoading: false,
          });
        }
      })
      .finally(hideLoading);

    return () => {
      cancelled = true;
    };
  }, [hideLoading, monthId, showLoading]);

  return state;
}
