import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { pl } from '../../i18n/pl';
import type { Employee } from '../../types/firestore';
import { EmployeeAutocomplete } from './EmployeeAutocomplete';

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

const anna = employee('employee-anna', 'Anna', 'Kowalska', 'WT-20');
const adam = employee('employee-adam', 'Adam', 'Kowalski', 'WT-10');
const duplicateAnna = employee('employee-anna-2', 'Anna', 'Kowalska', 'WT-21');

describe('EmployeeAutocomplete', () => {
  it('opens sorted options on focus and selects by keyboard using employee ID', async () => {
    const onChange = vi.fn();
    render(
      <EmployeeAutocomplete
        employees={[adam, anna]}
        value={null}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText(pl.employeeSelector.label);
    fireEvent.focus(input);

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Kowalska Anna (WT-20)',
      'Kowalski Adam (WT-10)',
    ]);

    fireEvent.change(input, { target: { value: 'adam kow' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('employee-adam'));
  });

  it('shows duplicate names separately and only exposes parent-provided scope', async () => {
    render(
      <EmployeeAutocomplete
        employees={[duplicateAnna, anna]}
        value={null}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(pl.employeeSelector.label);
    fireEvent.change(input, { target: { value: 'anna' } });
    expect(await screen.findByRole('option', { name: /WT-20/ })).toBeVisible();
    expect(screen.getByRole('option', { name: /WT-21/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /WT-10/ })).toBeNull();
  });

  it('supports clearing where the parent allows it', () => {
    const onChange = vi.fn();
    render(
      <EmployeeAutocomplete
        employees={[anna]}
        value={anna.id}
        onChange={onChange}
        allowClear
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: pl.employeeSelector.clear }),
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
