import type { EmployeeId } from '../types/firestore';
import type { EmployeeImportPreviewRow } from '../features/employees/employeeImport';
import type {
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import { createEmployee, updateEmployee } from './employeesService';

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
}

export async function updateEmployeesFromTemplatePreview(
  rows: readonly BulkEmployeeUpdatePreviewRow[],
  onProgress?: (progress: EmployeeImportProgress) => void,
): Promise<EmployeeBulkUpdateResult> {
  const updateRows = rows.filter(
    (row) =>
      (row.status === 'ready' || row.status === 'warning') &&
      row.employee &&
      row.updateInput,
  );

  const updatedEmployeeIds: EmployeeId[] = [];
  let completed = 0;
  onProgress?.({ completed, total: updateRows.length });
  await runWithConcurrency(
    updateRows,
    EMPLOYEE_IMPORT_UPDATE_CONCURRENCY,
    async (row) => {
      if (row.employee && row.updateInput) {
        await updateEmployee(row.employee.id, row.updateInput);
        updatedEmployeeIds.push(row.employee.id);
      }
      completed += 1;
      onProgress?.({ completed, total: updateRows.length });
    },
  );

  return {
    updatedEmployeeIds,
    skippedCount: rows.length - updateRows.length,
  };
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
