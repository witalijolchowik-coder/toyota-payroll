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
  phoneNumber: '+48 500 000 000',
  citizenship: 'PL',
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
  it('prioritizes employee name, phone and nationality without a redundant status column', () => {
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
    expect(screen.getAllByRole('columnheader')[1]).toHaveTextContent('Telefon');
    expect(screen.getByText('+48 500 000 000')).toBeInTheDocument();
    expect(screen.getByText('🇵🇱')).toBeInTheDocument();
    expect(screen.getByText('Metal')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Pierwsze zatrudnienie' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Aktualna umowa' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Pierwsze zatrudnienie / aktualna umowa'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('02.01.2025')).toBeInTheDocument();
    expect(screen.getByText('Limit: 02.07.2026')).toHaveStyle({
      color: '#8f2d3f',
    });
    expect(screen.getByText('Od:')).toBeInTheDocument();
    expect(screen.getByText('03.01.2026')).toBeInTheDocument();
    expect(screen.getByText('Do:')).toBeInTheDocument();
    expect(screen.getByText('bezterminowo')).toBeInTheDocument();
    expect(screen.getAllByText('Pierwsze zatrudnienie')).toHaveLength(1);
    expect(screen.getAllByText('Aktualna umowa')).toHaveLength(1);
  });

  it('exposes independent keyboard-accessible date sorting headers', () => {
    const onSort = vi.fn();
    render(
      <EmployeesTable
        employees={[employee]}
        departments={[department]}
        isLoading={false}
        mode="archive"
        sort={{ key: 'firstEmployment', direction: 'desc' }}
        onSort={onSort}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        entitlements={[]}
        onAccommodation={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: 'Pierwsze zatrudnienie' }),
    ).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(
      screen.getByRole('button', { name: 'Pierwsze zatrudnienie' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aktualna umowa' }));

    expect(onSort).toHaveBeenNthCalledWith(1, 'firstEmployment');
    expect(onSort).toHaveBeenNthCalledWith(2, 'currentContract');
  });

  it('shows a dated current contract in two concise lines for archived employees', () => {
    render(
      <EmployeesTable
        employees={[
          {
            ...employee,
            isActive: false,
            employmentEndDate: new Date('2026-08-31T00:00:00.000Z'),
          },
        ]}
        departments={[department]}
        isLoading={false}
        mode="archive"
        sort={{ key: 'currentContract', direction: 'asc' }}
        onSort={vi.fn()}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        entitlements={[]}
        onAccommodation={vi.fn()}
      />,
    );

    expect(screen.getByText('Od:')).toBeInTheDocument();
    expect(screen.getByText('03.01.2026')).toBeInTheDocument();
    expect(screen.getByText('Do:')).toBeInTheDocument();
    expect(screen.getByText('31.08.2026')).toBeInTheDocument();
    expect(screen.queryByText('Zakończenie')).not.toBeInTheDocument();
  });

  it('handles missing dates without inventing a limit or contract', () => {
    render(
      <EmployeesTable
        employees={[
          {
            ...employee,
            firstToyotaEmploymentDate: null,
            employmentStartDate: null,
            employmentEndDate: null,
          },
        ]}
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

    expect(screen.getByText('brak pierwszej daty')).toBeInTheDocument();
    expect(screen.getByText('brak aktualnej umowy')).toBeInTheDocument();
    expect(screen.queryByText(/^Limit:/)).not.toBeInTheDocument();
  });

  it('keeps accommodation, edit and deactivate actions working', () => {
    const onAccommodation = vi.fn();
    const onEdit = vi.fn();
    const onDeactivate = vi.fn();
    render(
      <EmployeesTable
        employees={[employee]}
        departments={[department]}
        isLoading={false}
        mode="active"
        sort={{ key: 'employee', direction: 'asc' }}
        onSort={vi.fn()}
        onEdit={onEdit}
        onDeactivate={onDeactivate}
        entitlements={[]}
        onAccommodation={onAccommodation}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Brak zakwaterowania firmowego' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Edytuj pracownika: Jan Kowalski' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Dezaktywuj pracownika: Jan Kowalski',
      }),
    );

    expect(onAccommodation).toHaveBeenCalledWith(employee, null);
    expect(onEdit).toHaveBeenCalledWith(employee);
    expect(onDeactivate).toHaveBeenCalledWith(employee);
  });
});
