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
  loadEmployeeContractState,
  previewEmployeeContractImpact,
  updateEmployeeContract,
} from '../../services/employeeContractsService';
import type { EmployeeContractImpact } from '../../services/employeeContractsService';
import type { EmployeeContractState } from '../../services/employeeContractsService';
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
      employeeId: EmployeeId,
      input: {
        sequenceId: string;
        startDate: string;
        endDate: string | null;
        note: string | null;
      },
      expectedRevision: string,
    ) =>
      runMutation(() =>
        createEmployeeContract(employeeId, input, expectedRevision),
      ),
    [runMutation],
  );

  const editContract = useCallback(
    (
      employeeId: EmployeeId,
      contractId: string,
      input: EmployeeContractUpdateInput,
      expectedRevision: string,
    ) =>
      runMutation(() =>
        updateEmployeeContract(employeeId, contractId, input, expectedRevision),
      ),
    [runMutation],
  );

  const cancelContract = useCallback(
    (employeeId: EmployeeId, contractId: string, expectedRevision: string) =>
      runMutation(() =>
        cancelEmployeeContract(employeeId, contractId, expectedRevision),
      ),
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
      employeeId: EmployeeId,
      input: {
        sequenceId: string;
        endDate: string;
        reason: string | null;
      },
      expectedRevision: string,
    ) =>
      runMutation(() =>
        endEmployeeEmployment(employeeId, input, expectedRevision),
      ),
    [runMutation],
  );
  const migrateLegacyContract = useCallback(
    (employeeId: EmployeeId, expectedRevision: string) =>
      runMutation(() =>
        bootstrapLegacyEmployeeContract(employeeId, expectedRevision),
      ),
    [runMutation],
  );
  const reloadEmployeeContracts = useCallback(
    (employeeId: EmployeeId): Promise<EmployeeContractState> =>
      runMutation(() => loadEmployeeContractState(employeeId)),
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
    reloadEmployeeContracts,
  };
}
