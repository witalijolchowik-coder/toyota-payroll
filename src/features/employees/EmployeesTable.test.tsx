import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import type { Department, Employee } from '../../types/firestore';
import { EmployeesTable } from './EmployeesTable';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test',
};
const employee = {
  id: 'employee-1',
  tetaNumber: 'WT-10',
  firstName: 'Jan',
  lastName: 'Kowalski',
  pesel: '90010112345',
  passportNumber: 'AB123456',
  foreignDocumentNumber: null,
  firstToyotaEmploymentDate: new Date('2025-01-02T00:00:00.000Z'),
  employmentStartDate: new Date('2026-01-03T00:00:00.000Z'),
  employmentEndDate: null,
  departmentId: 'metal',
  shiftAssignment: 'RED',
  isActive: true,
  ...metadata,
} as Employee;
const department = {
  id: 'metal',
  name: 'Metal',
  shiftMode: 'THREE_SHIFT',
  active: true,
  ...metadata,
} as Department;

describe('EmployeesTable', () => {
  it('prioritizes employee name and removes the redundant status column', () => {
    render(
      <EmployeesTable
        employees={[employee]}
        departments={[department]}
        isLoading={false}
        mode="active"
        sort={{ key: 'employee', direction: 'asc' }}
        onSort={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        entitlements={[]}
        onAccommodation={vi.fn()}
      />,
    );

    expect(screen.getByText('Jan Kowalski')).toHaveStyle({ fontWeight: '750' });
    expect(screen.getByText('TETA: WT-10')).toHaveStyle({
      display: 'block',
    });
    expect(
      screen.queryByRole('columnheader', { name: 'Numer TETA' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('PESEL: 90010112345')).toBeInTheDocument();
    expect(screen.getByText('Paszport: AB123456')).toBeInTheDocument();
    expect(screen.getByText('Metal')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Status' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Pierwsze zatrudnienie')).toBeInTheDocument();
    expect(screen.getByText('Aktualna umowa')).toBeInTheDocument();
    expect(screen.getByText('02.01.2025')).toBeInTheDocument();
    expect(screen.getByText('03.01.2026')).toBeInTheDocument();
  });

  it('exposes keyboard-accessible sortable headers', () => {
    const onSort = vi.fn();
    render(
      <EmployeesTable
        employees={[employee]}
        departments={[department]}
        isLoading={false}
        mode="archive"
        sort={{ key: 'shift', direction: 'desc' }}
        onSort={onSort}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        entitlements={[]}
        onAccommodation={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dział' }));
    expect(onSort).toHaveBeenCalledWith('department');
  });
});
