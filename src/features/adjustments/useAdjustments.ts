import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  cancelEmployeeAdjustment,
  createEmployeeAdjustment,
  loadAdjustmentWorkspace,
  updateEmployeeAdjustment,
} from '../../services/adjustmentsService';
import type {
  Adjustment,
  AdjustmentCreateInput,
  AdjustmentUpdateInput,
  Employee,
  MonthId,
  PayrollMonth,
} from '../../types/firestore';

interface AdjustmentState {
  month: PayrollMonth | null;
  employees: Employee[];
  adjustments: Adjustment[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: AdjustmentState = {
  month: null,
  employees: [],
  adjustments: [],
  isLoading: true,
  error: null,
};

export function useAdjustments(monthId: MonthId) {
  const [state, setState] = useState(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    showLoading();
    try {
      const data = await loadAdjustmentWorkspace(monthId);
      setState({ ...data, isLoading: false, error: null });
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      throw error;
    } finally {
      hideLoading();
    }
  }, [hideLoading, monthId, showLoading]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const mutate = async (operation: () => Promise<unknown>) => {
    showLoading();
    try {
      await operation();
      const data = await loadAdjustmentWorkspace(monthId);
      setState({ ...data, isLoading: false, error: null });
    } finally {
      hideLoading();
    }
  };

  return {
    ...state,
    createAdjustment: (input: AdjustmentCreateInput) =>
      mutate(() => createEmployeeAdjustment(monthId, input)),
    updateAdjustment: (adjustment: Adjustment, input: AdjustmentUpdateInput) =>
      mutate(() => updateEmployeeAdjustment(adjustment, input)),
    cancelAdjustment: (adjustment: Adjustment) =>
      mutate(() => cancelEmployeeAdjustment(adjustment)),
    reload,
  };
}
