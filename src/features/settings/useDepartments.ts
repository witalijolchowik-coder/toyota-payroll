import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createDepartment,
  loadDepartments,
  updateDepartment,
} from '../../services/departmentsService';
import type {
  Department,
  DepartmentCreateInput,
  DepartmentUpdateInput,
} from '../../types/firestore';

interface DepartmentsState {
  departments: Department[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: DepartmentsState = {
  departments: [],
  isLoading: true,
  error: null,
};

export function useDepartments() {
  const [state, setState] = useState(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  const reload = useCallback(async () => {
    showLoading();
    try {
      const departments = await loadDepartments();
      setState({ departments, isLoading: false, error: null });
    } catch (error) {
      setState({
        departments: [],
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

  const addDepartment = useCallback(
    async (input: DepartmentCreateInput) => {
      showLoading();
      try {
        await createDepartment(input);
        await reload();
      } finally {
        hideLoading();
      }
    },
    [hideLoading, reload, showLoading],
  );

  const editDepartment = useCallback(
    async (departmentId: string, input: DepartmentUpdateInput) => {
      showLoading();
      try {
        await updateDepartment(departmentId, input);
        await reload();
      } finally {
        hideLoading();
      }
    },
    [hideLoading, reload, showLoading],
  );

  return { ...state, addDepartment, editDepartment, reload };
}
