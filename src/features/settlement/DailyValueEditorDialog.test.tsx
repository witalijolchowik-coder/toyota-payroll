import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type { Employee } from '../../types/firestore';
import type { AbsenceCode } from '../../utils/absences';
import type { PlannedScheduleDay } from '../../utils/schedule';
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
const plannedDay: PlannedScheduleDay = {
  employeeId: employee.id,
  date: day.isoDate,
  status: 'WORKING' as const,
  source: 'automatic' as const,
  hours: 8,
  shift: 'FIRST' as const,
  label: 'I zmiana',
  departmentId: 'metal',
  shiftAssignment: 'RED' as const,
  reason: null,
  holidayName: null,
  plannedStartTime: '06:00',
  plannedEndTime: '14:00',
  plannedDuration: 8,
};

function renderDialog(
  overrides: {
    plannedDay?: PlannedScheduleDay;
    onSaveAbsence?: (code: AbsenceCode, note: string | null) => Promise<void>;
  } = {},
) {
  const onSaveAbsence = overrides.onSaveAbsence ?? vi.fn(async () => undefined);
  render(
    <DailyValueEditorDialog
      employee={employee}
      day={day}
      value={value}
      hasGoverningAbsence={false}
      plannedDay={overrides.plannedDay ?? plannedDay}
      onClose={vi.fn()}
      onSave={vi.fn()}
      onClear={vi.fn()}
      onSaveAbsence={onSaveAbsence}
    />,
  );
  return { onSaveAbsence };
}

describe('DailyValueEditorDialog', () => {
  it('shows the plan once and separates the work-time metrics', () => {
    renderDialog();

    expect(screen.getAllByText(/06:00–14:00/)).toHaveLength(1);
    expect(screen.getByTestId('worked-hours')).toHaveTextContent('8 h');
    expect(screen.getByTestId('shortage-hours')).toHaveTextContent('0 h');
    expect(screen.getByTestId('overtime-50-hours')).toHaveTextContent('0 h');
    expect(screen.getByTestId('overtime-100-hours')).toHaveTextContent('0 h');
    expect(screen.getByTestId('night-hours')).toHaveTextContent('0 h');
    expect(screen.getByText('Zgodne z planem')).toBeInTheDocument();
  });

  it('derives overtime or shortage previews from the actual interval', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '16:00' },
    });
    expect(screen.getByTestId('worked-hours')).toHaveTextContent('10 h');
    expect(screen.getByTestId('overtime-50-hours')).toHaveTextContent('2 h');
    expect(screen.getByText('Praca dłuższa niż plan')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '12:00' },
    });
    expect(screen.getByTestId('worked-hours')).toHaveTextContent('6 h');
    expect(screen.getByTestId('shortage-hours')).toHaveTextContent('2 h');
    expect(screen.getByText('Praca krótsza niż plan')).toBeInTheDocument();
  });

  it('shows night hours as a separate metric', () => {
    renderDialog({
      plannedDay: {
        ...plannedDay,
        shift: 'NIGHT',
        label: 'Zmiana nocna',
        plannedStartTime: '22:00',
        plannedEndTime: '06:00',
      },
    });

    expect(screen.getByTestId('night-hours')).toHaveTextContent('8 h');
  });

  it('saves manual L4 through the shared absence tab as reported', async () => {
    const saveAbsence = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSaveAbsence: saveAbsence });
    fireEvent.click(screen.getByRole('tab', { name: 'Nieobecność' }));
    expect(screen.getByTestId('absence-code-L4')).toBeInTheDocument();
    expect(screen.getByText('Zwolnienie lekarskie')).toBeInTheDocument();
    expect(screen.getByText(/zapisane jako „Zgłoszone”/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(saveAbsence).toHaveBeenCalledWith('L4', null));
  });
});
