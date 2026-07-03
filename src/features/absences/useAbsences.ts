import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  cancelAbsence,
  createAbsence,
  loadAbsenceWorkspace,
  updateAbsence,
} from '../../services/absencesService';
import type {
  Absence,
  AbsenceCreateInput,
  AbsenceUpdateInput,
  Employee,
  MonthId,
} from '../../types/firestore';

interface AbsenceState {
  absences: Absence[];
  currentAbsences: Absence[];
  employees: Employee[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: AbsenceState = {
  absences: [],
  currentAbsences: [],
  employees: [],
  isLoading: true,
  error: null,
};

export function useAbsences(monthId: MonthId) {
  const [state, setState] = useState<AbsenceState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    showLoading();
    try {
      const data = await loadAbsenceWorkspace(monthId);
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

  const runMutation = useCallback(
    async (operation: () => Promise<unknown>) => {
      showLoading();
      try {
        await operation();
        const data = await loadAbsenceWorkspace(monthId);
        setState({ ...data, isLoading: false, error: null });
      } finally {
        hideLoading();
      }
    },
    [hideLoading, monthId, showLoading],
  );

  return {
    ...state,
    createAbsence: (input: AbsenceCreateInput) =>
      runMutation(() => createAbsence(input)),
    updateAbsence: (absence: Absence, input: AbsenceUpdateInput) =>
      runMutation(() => updateAbsence(absence, input)),
    cancelAbsence: (absence: Absence) =>
      runMutation(() => cancelAbsence(absence)),
    reload,
  };
}
