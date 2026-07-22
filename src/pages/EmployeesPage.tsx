import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddOutlined from '@mui/icons-material/AddOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { Alert, Button, Card, Divider, Stack } from '@mui/material';

import { PageHeader } from '../components/layout/PageHeader';
import { DeactivateEmployeeDialog } from '../features/employees/DeactivateEmployeeDialog';
import { EmployeeEntitlementFormDialog } from '../features/employees/EmployeeEntitlementFormDialog';
import { EmployeeAccommodationDialog } from '../features/employees/EmployeeAccommodationDialog';
import { EmployeeEntitlementsPanel } from '../features/employees/EmployeeEntitlementsPanel';
import { EmployeeFormDialog } from '../features/employees/EmployeeFormDialog';
import { EmployeeContractsDialog } from '../features/employees/EmployeeContractsDialog';
import { EmployeeTemplateImportDialog } from '../features/employees/EmployeeTemplateImportDialog';
import { EmployeesEmptyState } from '../features/employees/EmployeesEmptyState';
import { EmployeesTable } from '../features/employees/EmployeesTable';
import { EmployeesToolbar } from '../features/employees/EmployeesToolbar';
import type {
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import type { EmployeeStatusFilter } from '../features/employees/types';
import {
  employeeMatchesListMode,
  nextEmployeeSort,
  sortEmployees,
  type EmployeeSortState,
} from '../features/employees/employeeTableModel';
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
  type EmployeeImportProgress,
} from '../services/employeeImportService';
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeEntitlement,
  EmployeeEntitlementCreateInput,
  EmployeeId,
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
    addContract,
    editContract,
    cancelContract,
    previewContractEdit,
    previewContractCancellation,
    endEmployment,
    migrateLegacyContract,
    reloadEmployeeContracts,
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
  const [status, setStatus] = useState<EmployeeStatusFilter>('active');
  const [sort, setSort] = useState<EmployeeSortState>({
    key: 'employee',
    direction: 'asc',
  });
  const [formState, setFormState] = useState<EmployeeFormState>(null);
  const [entitlementFormState, setEntitlementFormState] =
    useState<EntitlementFormState>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deactivationTarget, setDeactivationTarget] = useState<Employee | null>(
    null,
  );
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [accommodationState, setAccommodationState] = useState<{
    employee: Employee;
    currentAccommodation: EmployeeEntitlement | null;
  } | null>(null);
  const [contractsEmployeeId, setContractsEmployeeId] =
    useState<EmployeeId | null>(null);
  const contractsEmployee = useMemo(
    () =>
      contractsEmployeeId
        ? (employees.find((employee) => employee.id === contractsEmployeeId) ??
          null)
        : null,
    [contractsEmployeeId, employees],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pl-PL');
    const matching = employees.filter((employee) => {
      const matchesStatus = employeeMatchesListMode(
        employee,
        status,
        new Date(),
      );
      const searchableValue =
        `${employee.firstName} ${employee.lastName} ${employee.tetaNumber}`.toLocaleLowerCase(
          'pl-PL',
        );
      return (
        matchesStatus &&
        (!normalizedSearch || searchableValue.includes(normalizedSearch))
      );
    });
    return sortEmployees(matching, departments, sort);
  }, [departments, employees, search, sort, status]);

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
    onProgress?: (progress: EmployeeImportProgress) => void,
  ) => {
    const result = await updateEmployeesFromTemplatePreview(rows, onProgress);
    notify({
      message: interpolate(t.employees.templateImport.notifications.updated, {
        count: String(result.updatedEmployeeIds.length),
      }),
      severity: 'success',
    });
    return result;
  };

  const hasFilters = Boolean(search.trim()) || status !== 'active';

  useEffect(() => {
    const requestedContractsEmployeeId = searchParams.get(
      'contractsEmployeeId',
    );
    if (
      requestedContractsEmployeeId &&
      employees.length > 0 &&
      !contractsEmployeeId
    ) {
      const employee = employees.find(
        (candidate) => candidate.id === requestedContractsEmployeeId,
      );
      if (employee) {
        queueMicrotask(() => {
          setContractsEmployeeId(employee.id);
          const next = new URLSearchParams(searchParams);
          next.delete('contractsEmployeeId');
          setSearchParams(next, { replace: true });
        });
        return;
      }
    }
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
    queueMicrotask(() => {
      setFormState({ mode: 'edit', employee });
      const next = new URLSearchParams(searchParams);
      next.delete('editEmployeeId');
      setSearchParams(next, { replace: true });
    });
  }, [
    contractsEmployeeId,
    employees,
    formState,
    searchParams,
    setSearchParams,
  ]);

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
            mode={status}
            sort={sort}
            onSort={(key) =>
              setSort((current) => nextEmployeeSort(current, key))
            }
            onEdit={(employee) => setFormState({ mode: 'edit', employee })}
            onDeactivate={setDeactivationTarget}
            onContracts={(employee) => setContractsEmployeeId(employee.id)}
            entitlements={entitlements}
            onAccommodation={(employee, currentAccommodation) =>
              setAccommodationState({ employee, currentAccommodation })
            }
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

      {contractsEmployee ? (
        <EmployeeContractsDialog
          key={contractsEmployee.id}
          employee={contractsEmployee}
          onClose={() => setContractsEmployeeId(null)}
          onReload={reloadEmployeeContracts}
          onCreate={async (employeeId, input, revision) => {
            await addContract(employeeId, input, revision);
          }}
          onUpdate={async (employeeId, contractId, input, revision) => {
            await editContract(employeeId, contractId, input, revision);
          }}
          onCancelContract={(employeeId, contractId, revision) =>
            cancelContract(employeeId, contractId, revision)
          }
          onPreviewUpdate={previewContractEdit}
          onPreviewCancellation={previewContractCancellation}
          onEndEmployment={async (employeeId, input, revision) => {
            await endEmployment(employeeId, input, revision);
          }}
          onBootstrapLegacy={async (employeeId, revision) => {
            await migrateLegacyContract(employeeId, revision);
          }}
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

      {accommodationState ? (
        <EmployeeAccommodationDialog
          employee={accommodationState.employee}
          currentAccommodation={accommodationState.currentAccommodation}
          entitlements={entitlements}
          accommodationVariants={accommodationVariants}
          onClose={() => setAccommodationState(null)}
          onMoveIn={async (input) => {
            await addEntitlement(input);
            notify({
              message: t.employees.accommodation.moveInSaved,
              severity: 'success',
            });
          }}
          onMoveOut={async (entitlement, firstDayOutside) => {
            await editEntitlement(entitlement.id, {
              validTo: previousIsoDate(firstDayOutside),
              note: entitlement.note,
            });
            notify({
              message: t.employees.accommodation.moveOutSaved,
              severity: 'success',
            });
          }}
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

function previousIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
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
