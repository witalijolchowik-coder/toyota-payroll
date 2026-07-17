import type { EmployeeId } from '../types/firestore';
import type { EmployeeImportPreviewRow } from '../features/employees/employeeImport';
import type {
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import { createEmployee, updateEmployee } from './employeesService';
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
        rowResults.push({
          rowId: row.id,
          employeeId: row.employee?.id ?? null,
          status: row.status === 'blocked' ? 'blocked' : 'skipped',
          reason: row.warnings.join(', ') || null,
        });
      } else {
        try {
          await updateEmployee(row.employee.id, row.updateInput);
          await recordBulkRowAudit(row, importBatchId, 'success');
          updatedEmployeeIds.push(row.employee.id);
          rowResults.push({
            rowId: row.id,
            employeeId: row.employee.id,
            status: 'updated',
            reason: null,
          });
        } catch (error) {
          await recordBulkRowAudit(
            row,
            importBatchId,
            'failure',
            error instanceof Error ? error.message : String(error),
          ).catch(() => undefined);
          rowResults.push({
            rowId: row.id,
            employeeId: row.employee.id,
            status: 'error',
            reason: error instanceof Error ? error.message : String(error),
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

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(worker));
  }
}
