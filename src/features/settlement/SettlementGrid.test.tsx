import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SettlementGrid } from './SettlementGrid';
import { createCalendarDays } from './monthUtils';
import type { DailyValue, Department, Employee } from '../../types/firestore';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test',
};

const employee: Employee = {
  id: 'employee-1',
  tetaNumber: 'TETA-1001',
  firstName: 'Jan',
  lastName: 'Kowalski',
  pesel: null,
  passportNumber: null,
  foreignDocumentNumber: null,
  isActive: true,
  departmentId: 'montaz',
  shiftAssignment: 'RED',
  employmentStartDate: new Date('2026-06-01T00:00:00.000Z'),
  employmentEndDate: null,
  ...metadata,
};

const department: Department = {
  id: 'montaz',
  name: 'Montaż',
  shiftMode: 'THREE_SHIFT',
  active: true,
  ...metadata,
};

describe('SettlementGrid', () => {
  it('shows compact employee context without a separate TETA column', () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[]}
      />,
    );

    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Montaż · Zmiana Red')).toBeInTheDocument();
    expect(screen.queryByText('TETA-1001')).not.toBeInTheDocument();
  });

  it('opens the personal calendar from the employee name and the day editor from a cell', () => {
    const openCalendar = vi.fn();
    const editDay = vi.fn();
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[]}
        onOpenEmployeeCalendar={openCalendar}
        onEditCell={editDay}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Otwórz kalendarz pracownika: Jan Kowalski',
      }),
    );
    expect(openCalendar).toHaveBeenCalledWith(employee);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edytuj dzień: Kowalski Jan, 2026-06-01',
      }),
    );
    expect(editDay).toHaveBeenCalledTimes(1);
  });

  it('shows a readable overtime and night breakdown in hours mode', () => {
    const dailyValue: DailyValue = {
      id: 'employee-1_2026-06-01',
      monthId: '2026-06',
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      date: '2026-06-01',
      hours: 11,
      source: 'manual',
      importId: null,
      note: null,
      manualOverride: null,
      workTimeCorrection: {
        plannedShift: 'SECOND',
        plannedStartTime: '14:00',
        plannedEndTime: '22:00',
        actualStartTime: '13:00',
        actualEndTime: '00:00',
        classificationOverride: null,
      },
      ...metadata,
    };

    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[dailyValue]}
        displayMode="hours"
      />,
    );

    expect(screen.getByText('11 h')).toBeInTheDocument();
    expect(screen.getByText('+1 h · 50%')).toBeInTheDocument();
    expect(screen.getByText('+2 h · 100%')).toBeInTheDocument();
    expect(screen.getByText('2 h · noc')).toBeInTheDocument();
  });
});
