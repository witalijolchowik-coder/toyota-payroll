import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BulkEmployeeUpdatePreviewRow } from '../features/employees/employeeTemplateImport';
import { updateEmployeesFromTemplatePreview } from './employeeImportService';

const employeeServiceMocks = vi.hoisted(() => ({
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));
const contractServiceMocks = vi.hoisted(() => ({
  createEmployeeContract: vi.fn(),
  updateEmployeeContract: vi.fn(),
  EmployeeContractServiceError: class extends Error {
    constructor(
      readonly code: string,
      readonly details: string[] = [],
    ) {
      super(code);
    }
  },
}));

vi.mock('./employeesService', () => employeeServiceMocks);
vi.mock('./employeeContractsService', () => contractServiceMocks);

describe('employeeImportService', () => {
  beforeEach(() => {
    employeeServiceMocks.createEmployee.mockReset();
    employeeServiceMocks.updateEmployee.mockReset();
    contractServiceMocks.createEmployeeContract.mockReset();
    contractServiceMocks.updateEmployeeContract.mockReset();
  });

  it('uses the existing contract services for a create and a date correction', async () => {
    contractServiceMocks.createEmployeeContract.mockResolvedValue(
      'new-contract',
    );
    contractServiceMocks.updateEmployeeContract.mockResolvedValue(undefined);
    const row = updateRow('contracts', 'employee-1');
    row.changes = [];
    row.contractChanges = [
      {
        kind: 'update',
        existing: {
          id: 'old-contract',
          employeeId: 'employee-1',
          tetaNumber: 'WT-001',
          sequenceId: 'sequence-1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          status: 'ACTIVE',
          note: null,
          createdAt: new Date(),
          createdBy: 'test',
          updatedAt: new Date(),
          updatedBy: 'test',
        },
        imported: {
          slot: 1,
          startDate: '2026-01-01',
          endDate: '2026-03-30',
        },
      },
      {
        kind: 'create',
        existing: null,
        imported: {
          slot: 2,
          startDate: '2026-04-01',
          endDate: '2026-06-30',
        },
      },
    ];

    const result = await updateEmployeesFromTemplatePreview([row]);

    expect(contractServiceMocks.updateEmployeeContract).toHaveBeenCalledOnce();
    expect(contractServiceMocks.createEmployeeContract).toHaveBeenCalledOnce();
    expect(result.rows[0]?.status).toBe('updated');
  });

  it('reports a locked-month contract edit as blocked with month details', async () => {
    contractServiceMocks.updateEmployeeContract.mockRejectedValue(
      new contractServiceMocks.EmployeeContractServiceError('locked-month', [
        '2026-06',
      ]),
    );
    const row = updateRow('locked', 'employee-1');
    row.changes = [];
    row.contractChanges = [
      {
        kind: 'update',
        existing: {
          id: 'old-contract',
          employeeId: 'employee-1',
          tetaNumber: 'WT-001',
          sequenceId: 'sequence-1',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          status: 'ACTIVE',
          note: null,
          createdAt: new Date(),
          createdBy: 'test',
          updatedAt: new Date(),
          updatedBy: 'test',
        },
        imported: {
          slot: 1,
          startDate: '2026-01-01',
          endDate: '2026-06-29',
        },
      },
    ];

    const result = await updateEmployeesFromTemplatePreview([row]);

    expect(result.rows[0]).toMatchObject({
      status: 'blocked',
      reason: 'locked-month: 2026-06',
    });
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
    changes: [
      {
        field: 'phoneNumber',
        label: 'Numer telefonu',
        oldValue: '',
        newValue: '+48 500 000 000',
      },
    ],
    contractChanges: [],
    importedContracts: [],
    updateInput: {} as BulkEmployeeUpdatePreviewRow['updateInput'],
  };
}
