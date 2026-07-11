import type { EmployeeId } from '../types/firestore';
import type { EmployeeImportPreviewRow } from '../features/employees/employeeImport';
import { createEmployee } from './employeesService';

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
