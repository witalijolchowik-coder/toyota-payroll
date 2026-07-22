import type { EmployeeId } from '../types/firestore';
import type { EmployeeImportPreviewRow } from '../features/employees/employeeImport';
import type {
  BulkEmployeeContractChange,
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import { createEmployee, updateEmployee } from './employeesService';
import {
  createEmployeeContract,
  EmployeeContractServiceError,
  updateEmployeeContract,
} from './employeeContractsService';
import { auth } from '../config/firebase';
import { recordAuditEntry } from './auditService';

const EMPLOYEE_IMPORT_UPDATE_CONCURRENCY = 5;

export interface EmployeeImportProgress {
  completed: number;
  total: number;
}

export interface EmployeeImportCreateResult {
  createdEmployeeIds: EmployeeId[];
  skippedCount: number;
}

export async function createEmployeesFromImportPreview(
  rows: readonly EmployeeImportPreviewRow[],
): Promise<EmployeeImportCreateResult> {
  const createInputs = rows
    .filter((row) => row.status === 'new' && row.createInput)
    .map((row) => row.createInput);

  const createdEmployeeIds: EmployeeId[] = [];
  for (const input of createInputs) {
    if (input) {
      createdEmployeeIds.push(await createEmployee(input));
    }
  }

  return {
    createdEmployeeIds,
    skippedCount: rows.length - createInputs.length,
  };
}

export async function createEmployeesFromTemplatePreview(
  rows: readonly NewEmployeeTemplatePreviewRow[],
): Promise<EmployeeImportCreateResult> {
  const createRows = rows.filter(
    (row) => row.status === 'new' && row.createInput,
  );

  const createdEmployeeIds: EmployeeId[] = [];
  for (const row of createRows) {
    const input = row.createInput!;
    const employeeId = await createEmployee(input);
    createdEmployeeIds.push(employeeId);
    if (row.importedContracts.length <= 1) continue;
    let employee = syntheticImportedEmployee(employeeId, row);
    for (const imported of row.importedContracts.slice(1)) {
      const sequenceId = importedContractSequenceId(employee, imported);
      const id = await createEmployeeContract(employee.id, {
        sequenceId,
        startDate: imported.startDate,
        endDate: imported.endDate,
        note: 'Import zbiorczy umów',
      });
      employee = {
        ...employee,
        contracts: [
          ...(employee.contracts ?? []),
          importedContractRecord(employee, id, sequenceId, imported),
        ],
      };
    }
  }

  return {
    createdEmployeeIds,
    skippedCount: rows.length - createRows.length,
  };
}

function syntheticImportedEmployee(
  employeeId: EmployeeId,
  row: NewEmployeeTemplatePreviewRow,
) {
  const input = row.createInput!;
  const first = row.importedContracts[0]!;
  const now = new Date();
  const employee = {
    id: employeeId,
    ...input,
    employmentStartDate: input.initialContract?.startDate ?? null,
    employmentEndDate: input.initialContract?.endDate ?? null,
    createdAt: now,
    createdBy: auth?.currentUser?.uid ?? '',
    updatedAt: now,
    updatedBy: auth?.currentUser?.uid ?? '',
    contracts: [],
    employmentEndEvents: [],
  };
  return {
    ...employee,
    contracts: [
      importedContractRecord(
        employee,
        `initial-${employeeId}`,
        `initial-${employeeId}`,
        first,
      ),
    ],
  };
}

function importedContractRecord(
  employee: { id: string; tetaNumber: string },
  id: string,
  sequenceId: string,
  imported: { startDate: string; endDate: string },
) {
  const now = new Date();
  const uid = auth?.currentUser?.uid ?? '';
  return {
    id,
    employeeId: employee.id,
    tetaNumber: employee.tetaNumber,
    sequenceId,
    startDate: imported.startDate,
    endDate: imported.endDate,
    status: 'ACTIVE' as const,
    note: 'Import zbiorczy umów',
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid,
  };
}

export interface EmployeeBulkUpdateResult {
  updatedEmployeeIds: EmployeeId[];
  skippedCount: number;
  rows: EmployeeBulkUpdateRowResult[];
}

export type EmployeeBulkUpdateRowStatus =
  'updated' | 'skipped' | 'blocked' | 'error';

export interface EmployeeBulkUpdateRowResult {
  rowId: string;
  employeeId: EmployeeId | null;
  status: EmployeeBulkUpdateRowStatus;
  reason: string | null;
}

export async function updateEmployeesFromTemplatePreview(
  rows: readonly BulkEmployeeUpdatePreviewRow[],
  onProgress?: (progress: EmployeeImportProgress) => void,
): Promise<EmployeeBulkUpdateResult> {
  const updateRows = [...rows];

  const updatedEmployeeIds: EmployeeId[] = [];
  const rowResults: EmployeeBulkUpdateRowResult[] = [];
  const importBatchId = crypto.randomUUID();
  let completed = 0;
  onProgress?.({ completed, total: updateRows.length });
  await runWithConcurrency(
    updateRows,
    EMPLOYEE_IMPORT_UPDATE_CONCURRENCY,
    async (row) => {
      if (!row.employee || !row.updateInput) {
        if (
          row.employee &&
          row.contractChanges.some((change) => change.kind === 'unchanged')
        ) {
          await Promise.all(
            row.contractChanges
              .filter((change) => change.kind === 'unchanged')
              .map((change) =>
                recordContractImportAudit(
                  row,
                  importBatchId,
                  change,
                  'contract-import-unchanged',
                ),
              ),
          );
        }
        if (row.status === 'blocked') {
          await recordBulkRowAudit(
            row,
            importBatchId,
            'failure',
            row.warnings.join(', ') || 'blocked',
          ).catch(() => undefined);
        }
        rowResults.push({
          rowId: row.id,
          employeeId: row.employee?.id ?? null,
          status: row.status === 'blocked' ? 'blocked' : 'skipped',
          reason: row.warnings.join(', ') || null,
        });
      } else {
        try {
          if (row.changes.length > 0) {
            await updateEmployee(row.employee.id, row.updateInput);
          }
          await applyImportedContractChanges(row, importBatchId);
          await recordBulkRowAudit(row, importBatchId, 'success');
          updatedEmployeeIds.push(row.employee.id);
          rowResults.push({
            rowId: row.id,
            employeeId: row.employee.id,
            status: 'updated',
            reason: null,
          });
        } catch (error) {
          const reason = contractImportErrorReason(error);
          await recordBulkRowAudit(row, importBatchId, 'failure', reason).catch(
            () => undefined,
          );
          rowResults.push({
            rowId: row.id,
            employeeId: row.employee.id,
            status:
              error instanceof EmployeeContractServiceError &&
              error.code === 'locked-month'
                ? 'blocked'
                : 'error',
            reason,
          });
        }
      }
      completed += 1;
      onProgress?.({ completed, total: updateRows.length });
    },
  );

  const actorUid = auth?.currentUser?.uid;
  if (actorUid) {
    await recordAuditEntry({
      entityPath: 'employees',
      action: 'update',
      actorUid,
      changes: {
        operation: 'bulk-employee-update',
        import_batch_id: importBatchId,
        total: rows.length,
        updated: rowResults.filter((row) => row.status === 'updated').length,
        skipped: rowResults.filter((row) => row.status === 'skipped').length,
        blocked: rowResults.filter((row) => row.status === 'blocked').length,
        errors: rowResults.filter((row) => row.status === 'error').length,
      },
    });
  }

  return {
    updatedEmployeeIds,
    skippedCount: rowResults.filter((row) => row.status === 'skipped').length,
    rows: rowResults.sort((left, right) =>
      left.rowId.localeCompare(right.rowId),
    ),
  };
}

function contractImportErrorReason(error: unknown): string {
  if (error instanceof EmployeeContractServiceError) {
    return error.details.length > 0
      ? `${error.code}: ${error.details.join(', ')}`
      : error.code;
  }
  return error instanceof Error ? error.message : String(error);
}

async function recordBulkRowAudit(
  row: BulkEmployeeUpdatePreviewRow,
  importBatchId: string,
  status: 'success' | 'failure',
  errorMessage: string | null = null,
): Promise<void> {
  const actorUid = auth?.currentUser?.uid;
  if (!actorUid || !row.employee) return;
  await recordAuditEntry({
    entityPath: `employees/${row.employee.id}`,
    action: 'update',
    actorUid,
    changes: {
      operation: 'bulk-employee-update-row',
      import_batch_id: importBatchId,
      employee_id: row.employee.id,
      teta_number: row.employee.tetaNumber,
      changed_fields: row.changes.map((change) => change.field),
      before: Object.fromEntries(
        row.changes.map((change) => [change.field, change.oldValue]),
      ),
      after: Object.fromEntries(
        row.changes.map((change) => [change.field, change.newValue]),
      ),
      status,
      error: errorMessage,
    },
  });
}

async function applyImportedContractChanges(
  row: BulkEmployeeUpdatePreviewRow,
  importBatchId: string,
): Promise<void> {
  if (!row.employee) return;
  let employee = {
    ...row.employee,
    contracts: [...(row.employee.contracts ?? [])],
  };
  for (const change of row.contractChanges) {
    if (change.kind === 'unchanged') {
      await recordContractImportAudit(
        row,
        importBatchId,
        change,
        'contract-import-unchanged',
      );
      continue;
    }
    if (change.kind === 'untouched') continue;
    if (!change.imported) continue;
    if (change.kind === 'update' && change.existing) {
      await updateEmployeeContract(employee.id, change.existing.id, {
        startDate: change.imported.startDate,
        endDate: change.imported.endDate,
        note: change.existing.note,
      });
      await recordContractImportAudit(
        row,
        importBatchId,
        change,
        'contract-import-updated',
      );
      employee = {
        ...employee,
        contracts: (employee.contracts ?? []).map((contract) =>
          contract.id === change.existing!.id
            ? {
                ...contract,
                startDate: change.imported!.startDate,
                endDate: change.imported!.endDate,
              }
            : contract,
        ),
      };
      continue;
    }
    const sequenceId = importedContractSequenceId(employee, change.imported);
    const id = await createEmployeeContract(employee.id, {
      sequenceId,
      startDate: change.imported.startDate,
      endDate: change.imported.endDate,
      note: 'Import zbiorczy umów',
    });
    await recordContractImportAudit(
      row,
      importBatchId,
      change,
      'contract-import-created',
    );
    employee = {
      ...employee,
      contracts: [
        ...(employee.contracts ?? []),
        {
          id,
          employeeId: employee.id,
          tetaNumber: employee.tetaNumber,
          sequenceId,
          startDate: change.imported.startDate,
          endDate: change.imported.endDate,
          status: 'ACTIVE',
          note: 'Import zbiorczy umów',
          createdAt: new Date(),
          createdBy: auth?.currentUser?.uid ?? '',
          updatedAt: new Date(),
          updatedBy: auth?.currentUser?.uid ?? '',
        },
      ],
    };
  }
}

function importedContractSequenceId(
  employee: NonNullable<BulkEmployeeUpdatePreviewRow['employee']>,
  imported: { startDate: string },
): string {
  const previous = [...(employee.contracts ?? [])]
    .filter(
      (contract) =>
        contract.status === 'ACTIVE' &&
        contract.endDate &&
        contract.endDate < imported.startDate,
    )
    .sort((left, right) => right.endDate!.localeCompare(left.endDate!))[0];
  if (
    previous?.endDate &&
    nextIsoDate(previous.endDate) === imported.startDate
  ) {
    return previous.sequenceId;
  }
  return `import-${crypto.randomUUID()}`;
}

function nextIsoDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function recordContractImportAudit(
  row: BulkEmployeeUpdatePreviewRow,
  importBatchId: string,
  change: BulkEmployeeContractChange,
  operation: string,
): Promise<void> {
  const actorUid = auth?.currentUser?.uid;
  if (!actorUid || !row.employee) return;
  await recordAuditEntry({
    entityPath: `employees/${row.employee.id}`,
    action: 'update',
    actorUid,
    changes: {
      operation,
      import_batch_id: importBatchId,
      employee_id: row.employee.id,
      teta_number: row.employee.tetaNumber,
      contract_id: change.existing?.id ?? null,
      start_date: change.imported?.startDate ?? change.existing?.startDate,
      end_date: change.imported?.endDate ?? change.existing?.endDate,
    },
  });
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(worker));
  }
}
