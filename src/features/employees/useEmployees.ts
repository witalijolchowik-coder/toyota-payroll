import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createEmployee,
  deactivateEmployee,
  subscribeToEmployees,
  updateEmployee,
} from '../../services/employeesService';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeId,
} from '../../types/firestore';

interface EmployeeState {
  employees: Employee[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: EmployeeState = {
  employees: [],
  isLoading: true,
  error: null,
};

export function useEmployees() {
  const [state, setState] = useState<EmployeeState>(initialState);
  const { showLoading, hideLoading } = useGlobalLoading();

  useEffect(
    () =>
      subscribeToEmployees(
        (employees) => {
          setState({ employees, isLoading: false, error: null });
        },
        (error) => {
          setState((current) => ({
            ...current,
            isLoading: false,
            error,
          }));
        },
      ),
    [],
  );

  const runMutation = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      showLoading();
      try {
        return await operation();
      } finally {
        hideLoading();
      }
    },
    [hideLoading, showLoading],
  );

  const addEmployee = useCallback(
    (input: EmployeeCreateInput) => runMutation(() => createEmployee(input)),
    [runMutation],
  );

  const editEmployee = useCallback(
    (employeeId: EmployeeId, input: EmployeeCreateInput) =>
      runMutation(() => updateEmployee(employeeId, input)),
    [runMutation],
  );

  const setEmployeeInactive = useCallback(
    (employeeId: EmployeeId) =>
      runMutation(() => deactivateEmployee(employeeId)),
    [runMutation],
  );

  return {
    ...state,
    addEmployee,
    editEmployee,
    setEmployeeInactive,
  };
}
