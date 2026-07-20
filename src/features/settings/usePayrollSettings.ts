import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createPayrollSettingVersion,
  endPayrollSettingVersion,
  cancelFuturePayrollSettingVersion,
  loadPayrollSettings,
} from '../../services/payrollSettingsService';
import type {
  PayrollSetting,
  PayrollSettingCreateInput,
  MonthId,
} from '../../types/firestore';

interface PayrollSettingsState {
  settings: PayrollSetting[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: PayrollSettingsState = {
  settings: [],
  isLoading: true,
  error: null,
};

export function usePayrollSettings() {
  const [state, setState] = useState(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    showLoading();
    try {
      const settings = await loadPayrollSettings();
      setState({ settings, isLoading: false, error: null });
    } catch (error) {
      setState({
        settings: [],
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    } finally {
      hideLoading();
    }
  }, [hideLoading, showLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const createVersion = async (input: PayrollSettingCreateInput) => {
    showLoading();
    try {
      await createPayrollSettingVersion(input);
      const settings = await loadPayrollSettings();
      setState({ settings, isLoading: false, error: null });
    } finally {
      hideLoading();
    }
  };

  const endVersion = async (setting: PayrollSetting, validTo: string) => {
    showLoading();
    try {
      await endPayrollSettingVersion(setting, validTo as MonthId);
      await reload();
    } finally {
      hideLoading();
    }
  };

  const cancelVersion = async (
    setting: PayrollSetting,
    currentMonth: string,
  ) => {
    showLoading();
    try {
      await cancelFuturePayrollSettingVersion(setting, currentMonth as MonthId);
      await reload();
    } finally {
      hideLoading();
    }
  };

  return { ...state, createVersion, endVersion, cancelVersion, reload };
}
