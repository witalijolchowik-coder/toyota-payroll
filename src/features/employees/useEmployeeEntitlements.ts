import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  cancelEmployeeEntitlement,
  createEmployeeEntitlement,
  loadEmployeeEntitlements,
  updateEmployeeEntitlement,
} from '../../services/employeeEntitlementsService';
import type {
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  EmployeeEntitlementUpdateInput,
} from '../../types/firestore';

interface EmployeeEntitlementsState {
  entitlements: EmployeeEntitlement[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: EmployeeEntitlementsState = {
  entitlements: [],
  isLoading: true,
  error: null,
};

export function useEmployeeEntitlements() {
  const [state, setState] = useState<EmployeeEntitlementsState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const entitlements = await loadEmployeeEntitlements();
      setState({ entitlements, isLoading: false, error: null });
    } catch (error) {
      setState({
        entitlements: [],
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const runMutation = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      showLoading();
      try {
        const result = await operation();
        await reload();
        return result;
      } finally {
        hideLoading();
      }
    },
    [hideLoading, reload, showLoading],
  );

  return {
    ...state,
    reload,
    addEntitlement: (input: EmployeeEntitlementCreateInput) =>
      runMutation(() => createEmployeeEntitlement(input)),
    editEntitlement: (
      entitlementId: string,
      input: EmployeeEntitlementUpdateInput,
    ) => runMutation(() => updateEmployeeEntitlement(entitlementId, input)),
    cancelEntitlement: (entitlementId: string) =>
      runMutation(() => cancelEmployeeEntitlement(entitlementId)),
  };
}
