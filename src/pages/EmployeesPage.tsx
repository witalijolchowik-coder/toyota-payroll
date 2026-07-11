import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddOutlined from '@mui/icons-material/AddOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { Alert, Button, Card, Divider, Stack } from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { DeactivateEmployeeDialog } from '../features/employees/DeactivateEmployeeDialog';
import { EmployeeEntitlementFormDialog } from '../features/employees/EmployeeEntitlementFormDialog';
import { EmployeeEntitlementsPanel } from '../features/employees/EmployeeEntitlementsPanel';
import { EmployeeFormDialog } from '../features/employees/EmployeeFormDialog';
import { EmployeeTemplateImportDialog } from '../features/employees/EmployeeTemplateImportDialog';
import { EmployeesEmptyState } from '../features/employees/EmployeesEmptyState';
import { EmployeesTable } from '../features/employees/EmployeesTable';
import { EmployeesToolbar } from '../features/employees/EmployeesToolbar';
import type {
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import type { EmployeeStatusFilter } from '../features/employees/types';
import { useEmployees } from '../features/employees/useEmployees';
import { useEmployeeEntitlements } from '../features/employees/useEmployeeEntitlements';
import { useDepartments } from '../features/settings/useDepartments';
import { usePayrollSettings } from '../features/settings/usePayrollSettings';
import { useNotification } from '../hooks/useNotification';
import { useTranslations } from '../hooks/useTranslations';
import { interpolate } from '../i18n/pl';
import {
  EmployeeServiceError,
  type EmployeeServiceErrorCode,
} from '../services/employeesService';
import {
  createEmployeesFromTemplatePreview,
  updateEmployeesFromTemplatePreview,
} from '../services/employeeImportService';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
} from '../types/firestore';

type EmployeeFormState =
  { mode: 'add' } | { mode: 'edit'; employee: Employee } | null;
type EntitlementFormState =
  { mode: 'add' } | { mode: 'edit'; entitlement: EmployeeEntitlement } | null;

export function EmployeesPage() {
  const t = useTranslations();
  const { notify } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    employees,
    isLoading,
    error,
    addEmployee,
    editEmployee,
    setEmployeeInactive,
  } = useEmployees();
  const {
    departments,
    isLoading: areDepartmentsLoading,
    error: departmentsError,
  } = useDepartments();
  const { settings: payrollSettings, isLoading: arePayrollSettingsLoading } =
    usePayrollSettings();
  const {
    entitlements,
    isLoading: areEntitlementsLoading,
    error: entitlementsError,
    addEntitlement,
    editEntitlement,
    cancelEntitlement,
  } = useEmployeeEntitlements();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmployeeStatusFilter>('all');
  const [formState, setFormState] = useState<EmployeeFormState>(null);
  const [entitlementFormState, setEntitlementFormState] =
    useState<EntitlementFormState>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  const accommodationVariants = useMemo(
    () =>
      payrollSettings.filter(
        (setting) =>
          setting.active &&
          setting.settingKey === 'accommodation_allowance' &&
          setting.variantKey,
      ),
    [payrollSettings],
  );

  const handleEntitlementSubmit = async (
    input: EmployeeEntitlementCreateInput,
  ) => {
    if (entitlementFormState?.mode === 'edit') {
      await editEntitlement(entitlementFormState.entitlement.id, {
        validTo: input.validTo,
        note: input.note,
      });
      notify({
        message: t.employees.entitlements.notifications.updated,
        severity: 'success',
      });
      return;
    }

    await addEntitlement(input);
    notify({
      message: t.employees.entitlements.notifications.created,
      severity: 'success',
    });
  };

  const handleCancelEntitlement = async (entitlement: EmployeeEntitlement) => {
    try {
      await cancelEntitlement(entitlement.id);
      notify({
        message: t.employees.entitlements.notifications.cancelled,
        severity: 'success',
      });
    } catch {
      notify({
        message: t.employees.entitlements.errors.cancelFailed,
        severity: 'error',
      });
    }
  };

  const handleCreateEmployeesFromTemplate = async (
    rows: NewEmployeeTemplatePreviewRow[],
  ) => {
    const result = await createEmployeesFromTemplatePreview(rows);
    notify({
      message: interpolate(t.employees.templateImport.notifications.created, {
        count: String(result.createdEmployeeIds.length),
      }),
      severity: 'success',
    });
  };

  const handleUpdateEmployeesFromTemplate = async (
    rows: BulkEmployeeUpdatePreviewRow[],
  ) => {
    const result = await updateEmployeesFromTemplatePreview(rows);
    notify({
      message: interpolate(t.employees.templateImport.notifications.updated, {
        count: String(result.updatedEmployeeIds.length),
      }),
      severity: 'success',
    });
  };

  const hasFilters = Boolean(search.trim()) || status !== 'all';

  useEffect(() => {
    const editEmployeeId = searchParams.get('editEmployeeId');
    if (!editEmployeeId || employees.length === 0 || formState) {
      return;
    }
    const employee = employees.find(
      (candidate) => candidate.id === editEmployeeId,
    );
    if (!employee) {
      return;
    }
    setFormState({ mode: 'edit', employee });
    const next = new URLSearchParams(searchParams);
    next.delete('editEmployeeId');
    setSearchParams(next, { replace: true });
  }, [employees, formState, searchParams, setSearchParams]);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={t.employees.page.eyebrow}
        title={t.employees.page.title}
        description={t.employees.page.description}
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<UploadFileOutlined />}
              onClick={() => setIsImportOpen(true)}
            >
              {t.employees.templateImport.open}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={() => setFormState({ mode: 'add' })}
            >
              {t.employees.page.add}
            </Button>
          </Stack>
        }
      />

      {error ? (
        <Alert severity="error">
          <strong>{t.employees.errors.loadTitle}</strong>
          <br />
          {readErrorMessage(error, t)}
        </Alert>
      ) : null}

      {departmentsError ? (
        <Alert severity="warning">
          <strong>{t.organization.departments.loadTitle}</strong>
          <br />
          {t.organization.departments.loadDescription}
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
            departments={departments}
            isLoading={isLoading || areDepartmentsLoading}
            onEdit={(employee) => setFormState({ mode: 'edit', employee })}
            onDeactivate={setDeactivationTarget}
          />
        ) : (
          <EmployeesEmptyState filtered={hasFilters} />
        )}
      </Card>

      <EmployeeEntitlementsPanel
        employees={employees}
        entitlements={entitlements}
        accommodationVariants={accommodationVariants}
        isLoading={areEntitlementsLoading || arePayrollSettingsLoading}
        error={entitlementsError}
        onAdd={() => setEntitlementFormState({ mode: 'add' })}
        onEdit={(entitlement) =>
          setEntitlementFormState({ mode: 'edit', entitlement })
        }
        onCancel={(entitlement) => void handleCancelEntitlement(entitlement)}
      />

      {formState ? (
        <EmployeeFormDialog
          employee={formState.mode === 'edit' ? formState.employee : undefined}
          departments={departments}
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

      {entitlementFormState ? (
        <EmployeeEntitlementFormDialog
          entitlement={
            entitlementFormState.mode === 'edit'
              ? entitlementFormState.entitlement
              : undefined
          }
          employees={employees}
          entitlements={entitlements}
          accommodationVariants={accommodationVariants}
          onClose={() => setEntitlementFormState(null)}
          onSubmit={handleEntitlementSubmit}
        />
      ) : null}

      {isImportOpen ? (
        <EmployeeTemplateImportDialog
          employees={employees}
          departments={departments}
          onClose={() => setIsImportOpen(false)}
          onCreateEmployees={handleCreateEmployeesFromTemplate}
          onUpdateEmployees={handleUpdateEmployeesFromTemplate}
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
