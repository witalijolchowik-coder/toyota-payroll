import { useCallback, useEffect, useState } from 'react';

import { useGlobalLoading } from '../../hooks/useGlobalLoading';
import {
  createEmployee,
  deactivateEmployee,
  subscribeToEmployees,
  updateEmployee,
} from '../../services/employeesService';
import {
  cancelEmployeeContract,
  bootstrapLegacyEmployeeContract,
  createEmployeeContract,
  endEmployeeEmployment,
  previewEmployeeContractImpact,
  updateEmployeeContract,
} from '../../services/employeeContractsService';
import type { EmployeeContractImpact } from '../../services/employeeContractsService';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeContract,
  EmployeeContractUpdateInput,
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

  const addContract = useCallback(
    (
      employee: Employee,
      input: {
        sequenceId: string;
        startDate: string;
        endDate: string | null;
        note: string | null;
      },
    ) => runMutation(() => createEmployeeContract(employee, input)),
    [runMutation],
  );

  const editContract = useCallback(
    (
      employee: Employee,
      contract: EmployeeContract,
      input: EmployeeContractUpdateInput,
    ) => runMutation(() => updateEmployeeContract(employee, contract, input)),
    [runMutation],
  );

  const cancelContract = useCallback(
    (employee: Employee, contract: EmployeeContract) =>
      runMutation(() => cancelEmployeeContract(employee, contract)),
    [runMutation],
  );

  const previewContractEdit = useCallback(
    (
      contract: EmployeeContract,
      input: EmployeeContractUpdateInput,
    ): Promise<EmployeeContractImpact> =>
      previewEmployeeContractImpact([
        contract,
        { startDate: input.startDate, endDate: input.endDate },
      ]),
    [],
  );

  const previewContractCancellation = useCallback(
    (contract: EmployeeContract): Promise<EmployeeContractImpact> =>
      previewEmployeeContractImpact([contract]),
    [],
  );

  const endEmployment = useCallback(
    (
      employee: Employee,
      input: {
        sequenceId: string;
        endDate: string;
        reason: string | null;
      },
    ) => runMutation(() => endEmployeeEmployment(employee, input)),
    [runMutation],
  );
  const migrateLegacyContract = useCallback(
    (employee: Employee) =>
      runMutation(() => bootstrapLegacyEmployeeContract(employee)),
    [runMutation],
  );

  return {
    ...state,
    addEmployee,
    editEmployee,
    setEmployeeInactive,
    addContract,
    editContract,
    cancelContract,
    previewContractEdit,
    previewContractCancellation,
    endEmployment,
    migrateLegacyContract,
  };
}
