import { useMemo, useState } from 'react';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { Alert, Button, Card, Divider, Stack } from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { DeactivateEmployeeDialog } from '../features/employees/DeactivateEmployeeDialog';
import { EmployeeFormDialog } from '../features/employees/EmployeeFormDialog';
import { EmployeesEmptyState } from '../features/employees/EmployeesEmptyState';
import { EmployeesTable } from '../features/employees/EmployeesTable';
import { EmployeesToolbar } from '../features/employees/EmployeesToolbar';
import type { EmployeeStatusFilter } from '../features/employees/types';
import { useEmployees } from '../features/employees/useEmployees';
import { useNotification } from '../hooks/useNotification';
import { useTranslations } from '../hooks/useTranslations';
import {
  EmployeeServiceError,
  type EmployeeServiceErrorCode,
} from '../services/employeesService';
import type { Employee, EmployeeCreateInput } from '../types/firestore';

type EmployeeFormState =
  { mode: 'add' } | { mode: 'edit'; employee: Employee } | null;

export function EmployeesPage() {
  const t = useTranslations();
  const { notify } = useNotification();
  const {
    employees,
    isLoading,
    error,
    addEmployee,
    editEmployee,
    setEmployeeInactive,
  } = useEmployees();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatusFilter>('all');
  const [formState, setFormState] = useState<EmployeeFormState>(null);
  const [deactivationTarget, setDeactivationTarget] = useState<Employee | null>(
    null,
  );
  const [isDeactivating, setIsDeactivating] = useState(false);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pl-PL');
    return employees.filter((employee) => {
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && employee.isActive) ||
        (status === 'inactive' && !employee.isActive);
      const searchableValue =
        `${employee.firstName} ${employee.lastName} ${employee.tetaNumber}`.toLocaleLowerCase(
          'pl-PL',
        );
      return (
        matchesStatus &&
        (!normalizedSearch || searchableValue.includes(normalizedSearch))
      );
    });
  }, [employees, search, status]);

  const handleFormSubmit = async (input: EmployeeCreateInput) => {
    if (formState?.mode === 'edit') {
      await editEmployee(formState.employee.id, input);
      notify({
        message: t.employees.notifications.updated,
        severity: 'success',
      });
      return;
    }

    await addEmployee(input);
    notify({
      message: t.employees.notifications.created,
      severity: 'success',
    });
  };

  const handleDeactivate = async () => {
    if (!deactivationTarget) {
      return;
    }

    setIsDeactivating(true);
    try {
      await setEmployeeInactive(deactivationTarget.id);
      setDeactivationTarget(null);
      notify({
        message: t.employees.notifications.deactivated,
        severity: 'success',
      });
    } catch {
      notify({
        message: t.employees.errors.deactivateFailed,
        severity: 'error',
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const hasFilters = Boolean(search.trim()) || status !== 'all';

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={t.employees.page.eyebrow}
        title={t.employees.page.title}
        description={t.employees.page.description}
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setFormState({ mode: 'add' })}
          >
            {t.employees.page.add}
          </Button>
        }
      />

      {error ? (
        <Alert severity="error">
          <strong>{t.employees.errors.loadTitle}</strong>
          <br />
          {readErrorMessage(error, t)}
        </Alert>
      ) : null}

      <Card>
        <EmployeesToolbar
          search={search}
          status={status}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
        />
        <Divider />
        {isLoading || filteredEmployees.length > 0 ? (
          <EmployeesTable
            employees={filteredEmployees}
            isLoading={isLoading}
            onEdit={(employee) => setFormState({ mode: 'edit', employee })}
            onDeactivate={setDeactivationTarget}
          />
        ) : (
          <EmployeesEmptyState filtered={hasFilters} />
        )}
      </Card>

      {formState ? (
        <EmployeeFormDialog
          employee={formState.mode === 'edit' ? formState.employee : undefined}
          onClose={() => setFormState(null)}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {deactivationTarget ? (
        <DeactivateEmployeeDialog
          employee={deactivationTarget}
          isSubmitting={isDeactivating}
          onClose={() => setDeactivationTarget(null)}
          onConfirm={handleDeactivate}
        />
      ) : null}
    </Stack>
  );
}

function readErrorMessage(
  error: Error,
  t: ReturnType<typeof useTranslations>,
): string {
  const code = error instanceof EmployeeServiceError ? error.code : undefined;
  return serviceErrorMessage(code, t);
}

function serviceErrorMessage(
  code: EmployeeServiceErrorCode | undefined,
  t: ReturnType<typeof useTranslations>,
): string {
  if (code === 'firebase-unavailable') {
    return t.employees.errors.firebaseUnavailable;
  }
  if (code === 'authentication-required') {
    return t.employees.errors.authenticationRequired;
  }
  return t.employees.errors.loadDescription;
}
