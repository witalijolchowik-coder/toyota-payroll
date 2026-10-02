import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type {
  Employee,
  Absence,
  ScheduleCorrection,
  WorkTimeCorrectionInput,
} from '../../types/firestore';
import type { AbsenceCode } from '../../utils/absences';
import type { PlannedScheduleDay } from '../../utils/schedule';
import { createCalendarDays, type SettlementCellValue } from './monthUtils';
import { balanceFacts } from '../../utils/attendance/balanceFixtures.test-support';
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
const shiftIntervals = {
  FIRST: { startTime: '06:00', endTime: '14:00' },
  SECOND: { startTime: '14:00', endTime: '22:00' },
  NIGHT: { startTime: '22:00', endTime: '06:00' },
} as const;
const activeScheduleCorrection: ScheduleCorrection = {
  id: 'correction-1',
  monthId: '2026-06',
  employeeId: employee.id,
  tetaNumber: employee.tetaNumber,
  date: day.isoDate,
  kind: 'NIGHT_SHIFT',
  plannedShift: 'NIGHT',
  plannedHours: 8,
  note: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  createdBy: 'user-1',
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedBy: 'user-1',
};

function renderDialog(
  overrides: {
    value?: SettlementCellValue;
    governingAbsence?: Absence;
    plannedDay?: PlannedScheduleDay;
    activeScheduleCorrection?: ScheduleCorrection | null;
    onSaveAbsence?: (code: AbsenceCode, note: string | null) => Promise<void>;
    onSaveScheduleCorrection?: (
      shift: 'FIRST' | 'SECOND' | 'NIGHT',
      plannedHours: number,
      note: string | null,
    ) => Promise<void>;
    onResetScheduleCorrection?: () => Promise<void>;
    onSave?: (
      hours: number,
      note: string | null,
      workTimeCorrection: WorkTimeCorrectionInput | null,
    ) => Promise<void>;
  } = {},
) {
  const onSaveAbsence = overrides.onSaveAbsence ?? vi.fn(async () => undefined);
  const onSaveScheduleCorrection =
    overrides.onSaveScheduleCorrection ?? vi.fn(async () => undefined);
  const onResetScheduleCorrection =
    overrides.onResetScheduleCorrection ?? vi.fn(async () => undefined);
  const onSave = overrides.onSave ?? vi.fn(async () => undefined);
  const onClear = vi.fn(async () => undefined);
  const onWorkTimeCommitted = vi.fn(async () => undefined);
  render(
    <DailyValueEditorDialog
      employee={employee}
      day={day}
      value={overrides.value ?? value}
      hasGoverningAbsence={Boolean(overrides.governingAbsence)}
      governingAbsence={overrides.governingAbsence}
      plannedDay={overrides.plannedDay ?? plannedDay}
      shiftIntervals={shiftIntervals}
      activeScheduleCorrection={overrides.activeScheduleCorrection}
      onClose={vi.fn()}
      onSave={onSave}
      onClear={onClear}
      onSaveScheduleCorrection={onSaveScheduleCorrection}
      onResetScheduleCorrection={onResetScheduleCorrection}
      onWorkTimeCommitted={onWorkTimeCommitted}
      onSaveAbsence={onSaveAbsence}
    />,
  );
  return {
    onSave,
    onClear,
    onSaveAbsence,
    onSaveScheduleCorrection,
    onResetScheduleCorrection,
    onWorkTimeCommitted,
  };
}

describe('DailyValueEditorDialog', () => {
  it('preserves an unchanged imported time override matching raw hours after reopening', async () => {
    const { onSave, onClear } = renderDialog({
      value: {
        ...value,
        kind: 'imported-override',
        workTimeCorrection: {
          plannedShift: 'FIRST',
          plannedStartTime: '06:00',
          plannedEndTime: '14:00',
          actualStartTime: '06:00',
          actualEndTime: '14:00',
          classificationOverride: null,
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
    expect(onClear).not.toHaveBeenCalled();
  });
  it('saves changed Balance hours through an actual-time override', async () => {
    const { onSave } = renderDialog({
      value: {
        ...value,
        kind: 'imported',
        balanceSourceFacts: balanceFacts(),
      },
    });
    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '16:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        10,
        null,
        expect.objectContaining({
          actualStartTime: '06:00',
          actualEndTime: '16:00',
        }),
      ),
    );
  });
  it.each(['UW', 'UO', 'NN', 'NI'] as const)(
    'allows confirmed replacement of raw Balance hours with %s',
    async (code) => {
      const { onSaveAbsence } = renderDialog({
        value: {
          ...value,
          kind: 'imported',
          balanceSourceFacts: balanceFacts(),
        },
      });
      fireEvent.click(screen.getByRole('tab', { name: 'Nieobecność' }));
      fireEvent.mouseDown(screen.getByLabelText('Rodzaj nieobecności'));
      fireEvent.click(
        screen.getByRole('option', { name: new RegExp(`^${code} `) }),
      );
      const save = screen.getByRole('button', { name: 'Zapisz' });
      expect(save).toBeDisabled();
      expect(
        screen.queryByText(/Oryginalne godziny z importu nie mogą/),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('checkbox', {
          name: 'Zastąp godziny z Bilansu nieobecnością. Dane źródłowe Bilansu pozostaną zachowane.',
        }),
      );
      expect(save).toBeEnabled();
      fireEvent.click(save);
      await waitFor(() =>
        expect(onSaveAbsence).toHaveBeenCalledWith(code, null),
      );
    },
  );
  it('also allows absence replacement of an existing imported manual override', () => {
    renderDialog({ value: { ...value, kind: 'imported-override', hours: 6 } });
    fireEvent.click(screen.getByRole('tab', { name: 'Nieobecność' }));
    expect(screen.getByLabelText('Rodzaj nieobecności')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
  });
  it('keeps imported L4 protected even when raw Balance attendance exists', () => {
    renderDialog({
      value: { ...value, kind: 'imported', balanceSourceFacts: balanceFacts() },
      governingAbsence: {
        id: 'l4',
        employeeId: employee.id,
        tetaNumber: employee.tetaNumber,
        monthId: '2026-06',
        startDate: day.isoDate,
        endDate: day.isoDate,
        absenceCode: 'L4',
        source: 'absence_import',
        importId: 'zus',
        status: 'ACTIVE',
        hoursPerDay: null,
        note: null,
        createdAt: day.date,
        updatedAt: day.date,
        createdBy: 'test',
        updatedBy: 'test',
      },
    });
    expect(
      screen.queryByLabelText('Rodzaj nieobecności'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
  });
  it('saves changed Balance punches even when credited hours remain 8 and match the plan', async () => {
    const { onSave } = renderDialog({
      value: {
        ...value,
        kind: 'imported',
        balanceSourceFacts: balanceFacts({
          actual_start_time: '05:30',
          actual_end_time: '14:30',
          presence_hours: 9,
        }),
      },
    });
    fireEvent.change(screen.getByLabelText('Rzeczywisty start'), {
      target: { value: '06:00' },
    });
    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '14:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(8, null, {
        workContext: 'NORMATIVE',
        plannedShift: 'FIRST',
        plannedStartTime: '06:00',
        plannedEndTime: '14:00',
        actualStartTime: '06:00',
        actualEndTime: '14:00',
        classificationOverride: null,
      }),
    );
  });
  it('saves explicit imported override times even when hours return to the raw quantity', async () => {
    const { onSave } = renderDialog({
      value: {
        ...value,
        kind: 'imported-override',
        hours: 6,
        workTimeCorrection: {
          plannedShift: 'FIRST',
          plannedStartTime: '06:00',
          plannedEndTime: '14:00',
          actualStartTime: '06:00',
          actualEndTime: '12:00',
          classificationOverride: null,
        },
      },
    });
    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '14:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        8,
        null,
        expect.objectContaining({
          actualEndTime: '14:00',
        }),
      ),
    );
  });
  it('does not fabricate timestamps or clear a quantity-only imported override on reopening', () => {
    renderDialog({ value: { ...value, kind: 'imported-override', hours: 6 } });
    expect(screen.getByLabelText('Rzeczywisty start')).toHaveValue('');
    expect(screen.getByLabelText('Rzeczywisty koniec')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
  });
  it('shows Balance punches but keeps credited hours and extra pool on an unchanged save', async () => {
    const { onSave, onSaveScheduleCorrection } = renderDialog({
      value: {
        ...value,
        kind: 'imported',
        hours: 10,
        fallbackHours: 10,
        balanceSourceFacts: balanceFacts({
          actual_end_time: '16:30',
          credited_hours: 10,
          extra_hours: 2,
        }),
      },
    });
    expect(screen.getByLabelText('Rzeczywisty koniec')).toHaveValue('16:30');
    expect(screen.getByTestId('worked-hours')).toHaveTextContent('10 h');
    expect(screen.getByTestId('overtime-50-hours')).toHaveTextContent('2 h');
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
    expect(onSaveScheduleCorrection).not.toHaveBeenCalled();
  });
  it('does not fabricate a missing Balance punch from the brigade plan', () => {
    renderDialog({
      value: {
        ...value,
        kind: 'imported',
        balanceSourceFacts: balanceFacts({ actual_end_time: null }),
      },
    });
    expect(screen.getByLabelText('Rzeczywisty koniec')).toHaveValue('');
    expect(screen.getByTestId('worked-hours')).toHaveTextContent('8 h');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
  });
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

  it('persists a selected shift even when its standard hours need no daily value', async () => {
    const { onSave, onSaveScheduleCorrection, onWorkTimeCommitted } =
      renderDialog();

    fireEvent.mouseDown(screen.getByLabelText('Planowana zmiana'));
    fireEvent.click(screen.getByRole('option', { name: 'Nocna zmiana' }));

    expect(screen.getByLabelText('Rzeczywisty start')).toHaveValue('22:00');
    expect(screen.getByLabelText('Rzeczywisty koniec')).toHaveValue('06:00');
    expect(screen.getByTestId('night-hours')).toHaveTextContent('8 h');

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() =>
      expect(onSaveScheduleCorrection).toHaveBeenCalledWith('NIGHT', 8, null),
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(onWorkTimeCommitted).toHaveBeenCalledWith('saved');
  });

  it('stores actual times separately when they differ from the corrected planned shift', async () => {
    const { onSave, onSaveScheduleCorrection } = renderDialog();

    fireEvent.mouseDown(screen.getByLabelText('Planowana zmiana'));
    fireEvent.click(screen.getByRole('option', { name: 'Nocna zmiana' }));
    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '08:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    await waitFor(() =>
      expect(onSaveScheduleCorrection).toHaveBeenCalledWith('NIGHT', 8, null),
    );
    expect(onSave).toHaveBeenCalledWith(10, null, {
      workContext: 'NORMATIVE',
      plannedShift: 'NIGHT',
      plannedStartTime: '22:00',
      plannedEndTime: '06:00',
      actualStartTime: '22:00',
      actualEndTime: '08:00',
      classificationOverride: null,
    });
  });

  it('saves actual extra work on a normatively free day without a planned shift', async () => {
    const freeDay: PlannedScheduleDay = {
      ...plannedDay,
      status: 'DAY_OFF',
      source: 'calendar',
      hours: 0,
      shift: null,
      label: 'W',
      plannedStartTime: null,
      plannedEndTime: null,
      plannedDuration: 0,
    };
    const { onSave, onSaveScheduleCorrection } = renderDialog({
      plannedDay: freeDay,
    });

    expect(screen.queryByLabelText('Planowana zmiana')).not.toBeInTheDocument();
    expect(
      screen.getByText(/wolny w normatywnym grafiku/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rzeczywisty start'), {
      target: { value: '22:00' },
    });
    fireEvent.change(screen.getByLabelText('Rzeczywisty koniec'), {
      target: { value: '06:00' },
    });

    expect(screen.getByTestId('overtime-100-hours')).toHaveTextContent('8 h');
    expect(screen.getByTestId('overtime-50-hours')).toHaveTextContent('0 h');
    expect(screen.getByTestId('night-hours')).toHaveTextContent('8 h');

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(8, null, {
        workContext: 'EXTRA',
        plannedShift: null,
        plannedStartTime: null,
        plannedEndTime: null,
        actualStartTime: '22:00',
        actualEndTime: '06:00',
        classificationOverride: null,
      }),
    );
    expect(onSaveScheduleCorrection).not.toHaveBeenCalled();
  });

  it('resets an active daily schedule correction to the generated schedule', async () => {
    const nightPlan = {
      ...plannedDay,
      source: 'manual-correction' as const,
      shift: 'NIGHT' as const,
      label: '8 / N',
      plannedStartTime: '22:00',
      plannedEndTime: '06:00',
    };
    const { onResetScheduleCorrection, onWorkTimeCommitted } = renderDialog({
      plannedDay: nightPlan,
      activeScheduleCorrection,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Przywróć zmianę z grafiku' }),
    );
    await waitFor(() => expect(onResetScheduleCorrection).toHaveBeenCalled());
    expect(onWorkTimeCommitted).toHaveBeenCalledWith('saved');
  });

  it('does not write or audit an unchanged active correction when reopened', () => {
    const nightPlan = {
      ...plannedDay,
      source: 'manual-correction' as const,
      shift: 'NIGHT' as const,
      label: '8 / N',
      plannedStartTime: '22:00',
      plannedEndTime: '06:00',
    };
    const { onSave, onSaveScheduleCorrection, onWorkTimeCommitted } =
      renderDialog({
        plannedDay: nightPlan,
        activeScheduleCorrection,
      });

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(onSaveScheduleCorrection).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onWorkTimeCommitted).not.toHaveBeenCalled();
  });

  it('saves manual L4 through the shared absence tab as reported', async () => {
    const saveAbsence = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onSaveAbsence: saveAbsence });
    fireEvent.click(screen.getByRole('tab', { name: 'Nieobecność' }));
    expect(screen.getByTestId('absence-code-L4')).toBeInTheDocument();
    expect(screen.getByText('Godziny chorobowe')).toBeInTheDocument();
    expect(screen.getByText(/zapisane jako „Zgłoszone”/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(saveAbsence).toHaveBeenCalledWith('L4', null));
  });
});
