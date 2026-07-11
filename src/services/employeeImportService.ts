import type { EmployeeId } from '../types/firestore';
import type { EmployeeImportPreviewRow } from '../features/employees/employeeImport';
import type {
  BulkEmployeeUpdatePreviewRow,
  NewEmployeeTemplatePreviewRow,
} from '../features/employees/employeeTemplateImport';
import { createEmployee, updateEmployee } from './employeesService';

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
): Promise<EmployeeBulkUpdateResult> {
  const updateRows = rows.filter(
    (row) =>
      (row.status === 'ready' || row.status === 'warning') &&
      row.employee &&
      row.updateInput,
  );

  const updatedEmployeeIds: EmployeeId[] = [];
  for (const row of updateRows) {
    if (row.employee && row.updateInput) {
      await updateEmployee(row.employee.id, row.updateInput);
      updatedEmployeeIds.push(row.employee.id);
    }
  }

  return {
    updatedEmployeeIds,
    skippedCount: rows.length - updateRows.length,
  };
}
