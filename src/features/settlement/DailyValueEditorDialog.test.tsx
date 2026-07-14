import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type { Employee } from '../../types/firestore';
import { createCalendarDays } from './monthUtils';
import { DailyValueEditorDialog } from './DailyValueEditorDialog';

const employee = {
  id: 'employee-1',
  tetaNumber: 'WT-1',
  firstName: 'Jan',
  lastName: 'Kowalski',
  employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
  employmentEndDate: null,
} as Employee;
const day = createCalendarDays('2026-06')[0]!;
const value = {
  kind: 'virtual-default' as const,
  calendarState: 'working' as const,
  hours: 8,
  fallbackHours: 8,
  coordinatorNote: null,
};

describe('DailyValueEditorDialog', () => {
  it('uses planned hours and derives overtime or shortage previews', () => {
    render(
      <DailyValueEditorDialog
        employee={employee}
        day={day}
        value={value}
        hasGoverningAbsence={false}
        plannedDay={{
          employeeId: employee.id,
          date: day.isoDate,
          status: 'WORKING',
          source: 'automatic',
          hours: 8,
          shift: 'FIRST',
          label: 'I zmiana',
          departmentId: 'metal',
          shiftAssignment: 'RED',
          reason: null,
          holidayName: null,
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onSaveAbsence={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Godziny rzeczywiste')).toHaveValue('8');
    fireEvent.change(screen.getByLabelText('Godziny rzeczywiste'), {
      target: { value: '10' },
    });
    expect(screen.getByText(/nadgodziny 50% 2 h/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Godziny rzeczywiste'), {
      target: { value: '6' },
    });
    expect(screen.getByText(/czas prywatny 2 h/i)).toBeInTheDocument();
  });

  it('saves manual L4 through the shared absence tab as reported', async () => {
    const saveAbsence = vi.fn().mockResolvedValue(undefined);
    render(
      <DailyValueEditorDialog
        employee={employee}
        day={day}
        value={{ ...value, kind: 'empty', hours: null, fallbackHours: null }}
        hasGoverningAbsence={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        onSaveAbsence={saveAbsence}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Nieobecność' }));
    expect(screen.getByText(/zapisane jako „Zgłoszone”/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(saveAbsence).toHaveBeenCalledWith('L4', null));
  });
});
