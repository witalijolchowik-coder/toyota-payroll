import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pl } from '../../i18n/pl';
import type { Employee } from '../../types/firestore';
import { AbsenceFormDialog } from './AbsenceFormDialog';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test',
};

function employee(
  id: string,
  firstName: string,
  lastName: string,
  tetaNumber: string,
): Employee {
  return {
    id,
    firstName,
    lastName,
    tetaNumber,
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
    employmentEndDate: null,
    ...metadata,
  };
}

describe('AbsenceFormDialog employee workflow', () => {
  it('submits the selected employee ID and matching TETA', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const employees = [
      employee('employee-1', 'Jan', 'Nowak', 'WT-01'),
      employee('employee-2', 'Anna', 'Żak', 'WT-02'),
    ];

    render(
      <AbsenceFormDialog
        employees={employees}
        defaultStartDate="2026-07-15"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    const selector = screen.getByLabelText(pl.absences.form.employee);
    fireEvent.change(selector, { target: { value: 'zak anna' } });
    fireEvent.keyDown(selector, { key: 'ArrowDown' });
    fireEvent.keyDown(selector, { key: 'Enter' });
    fireEvent.click(
      screen.getByRole('button', { name: pl.absences.form.create }),
    );

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'employee-2',
          tetaNumber: 'WT-02',
          absenceCode: 'L4',
        }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
