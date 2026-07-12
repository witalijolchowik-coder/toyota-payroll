import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BulkEmployeeUpdatePreviewRow } from '../features/employees/employeeTemplateImport';
import { updateEmployeesFromTemplatePreview } from './employeeImportService';

const employeeServiceMocks = vi.hoisted(() => ({
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

vi.mock('./employeesService', () => employeeServiceMocks);

describe('employeeImportService', () => {
  beforeEach(() => {
    employeeServiceMocks.createEmployee.mockReset();
    employeeServiceMocks.updateEmployee.mockReset();
  });

  it('reports progress while applying bulk employee updates', async () => {
    employeeServiceMocks.updateEmployee.mockResolvedValue(undefined);
    const progress: { completed: number; total: number }[] = [];

    const result = await updateEmployeesFromTemplatePreview(
      [
        updateRow('update-1', 'employee-1'),
        updateRow('update-2', 'employee-2'),
        updateRow('update-3', 'employee-3'),
      ],
      (value) => progress.push(value),
    );

    expect(employeeServiceMocks.updateEmployee).toHaveBeenCalledTimes(3);
    expect(result.updatedEmployeeIds).toEqual([
      'employee-1',
      'employee-2',
      'employee-3',
    ]);
    expect(progress[0]).toEqual({ completed: 0, total: 3 });
    expect(progress.at(-1)).toEqual({ completed: 3, total: 3 });
  });
});

function updateRow(
  id: string,
  employeeId: string,
): BulkEmployeeUpdatePreviewRow {
  return {
    id,
    rowNumber: 1,
    status: 'ready',
    employee: { id: employeeId } as BulkEmployeeUpdatePreviewRow['employee'],
    tetaNumber: 'WT-001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    warnings: [],
    changes: [],
    updateInput: {} as BulkEmployeeUpdatePreviewRow['updateInput'],
  };
}
