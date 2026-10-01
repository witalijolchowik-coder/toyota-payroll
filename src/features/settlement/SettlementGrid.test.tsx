import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { SettlementGrid } from './SettlementGrid';
import { createCalendarDays } from './monthUtils';
import type {
  DailyValue,
  Department,
  Employee,
  EmployeeAssignment,
  ScheduleCorrection,
  Absence,
} from '../../types/firestore';

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
  departmentId: 'montaz-toyota',
  shiftAssignment: 'RED',
  employmentStartDate: new Date('2026-06-01T00:00:00.000Z'),
  employmentEndDate: null,
  contracts: [
    {
      id: 'contract-1',
      employeeId: 'employee-1',
      tetaNumber: 'TETA-1001',
      sequenceId: 'sequence-1',
      startDate: '2026-06-01',
      endDate: null,
      status: 'ACTIVE',
      note: null,
      ...metadata,
    },
  ],
  ...metadata,
};

const department: Department = {
  id: 'montaz-toyota',
  name: 'Montaż Toyota',
  shiftMode: 'THREE_SHIFT',
  active: true,
  ...metadata,
};

describe('SettlementGrid', () => {
  it('shows L4 only inside employment and hides raw Balance work after termination', () => {
    const target: Employee = {
      ...employee,
      isActive: false,
      contracts: [
        {
          ...employee.contracts![0]!,
          startDate: '2026-09-01',
          endDate: '2026-09-16',
        },
      ],
      employmentEndEvents: [
        {
          id: 'end-1',
          employeeId: employee.id,
          tetaNumber: employee.tetaNumber,
          sequenceId: 'sequence-1',
          endDate: '2026-09-16',
          status: 'ACTIVE',
          reason: null,
          ...metadata,
        },
      ],
    };
    const source: Absence = {
      id: 'source-l4',
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      monthId: '2026-09',
      absenceCode: 'L4',
      startDate: '2026-09-15',
      endDate: '2026-09-20',
      hoursPerDay: null,
      source: 'absence_import',
      importId: 'zus-import',
      status: 'ACTIVE',
      note: null,
      ...metadata,
    };
    const attendance: DailyValue = {
      id: 'source-work',
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      monthId: '2026-09',
      date: '2026-09-17',
      hours: 10,
      source: 'attendance_import',
      importId: 'balance-import',
      manualOverride: null,
      note: null,
      ...metadata,
    };
    render(
      <SettlementGrid
        employees={[target]}
        departments={[department]}
        days={createCalendarDays('2026-09', {
          today: new Date('2026-10-01'),
        }).filter((d) => ['2026-09-15', '2026-09-17'].includes(d.isoDate))}
        dailyValues={[attendance]}
        absences={[source]}
      />,
    );
    const row = screen.getByText('Jan Kowalski').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('L4');
    expect(cells[2]).not.toHaveTextContent('L4');
    expect(cells[2]).not.toHaveTextContent('10 h');
    expect(source.endDate).toBe('2026-09-20');
    expect(attendance.hours).toBe(10);
  });
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
    expect(screen.getByText('Montaż Toyota')).toBeInTheDocument();
    expect(screen.getByText('Zmiana Red')).toBeInTheDocument();
    expect(screen.queryByText('TETA-1001')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('settlement-department-group-montaz-toyota'),
    ).toHaveTextContent('1');
  });

  it('shows the dated effective group instead of the conflicting master group', () => {
    const blueMaster = { ...employee, shiftAssignment: 'BLUE' as const };
    render(
      <SettlementGrid
        employees={[blueMaster]}
        departments={[department]}
        employeeAssignments={[
          assignment(blueMaster, 'RED', '2026-07-01', null),
        ]}
        days={createCalendarDays('2026-07')}
        dailyValues={[]}
      />,
    );

    expect(screen.getByText('Zmiana Red')).toBeInTheDocument();
    expect(screen.queryByText('Zmiana Blue')).not.toBeInTheDocument();
  });

  it('shows the visible First-shift fallback when the dated group is missing', () => {
    const blueMaster = { ...employee, shiftAssignment: 'BLUE' as const };
    render(
      <SettlementGrid
        employees={[blueMaster]}
        departments={[department]}
        employeeAssignments={[assignment(blueMaster, null, '2026-07-01', null)]}
        days={createCalendarDays('2026-07')}
        dailyValues={[]}
      />,
    );

    expect(
      screen.getByText('Brak grupy · plan: pierwsza zmiana'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'Brak grupy zmianowej w obowiązującym przypisaniu. Plan automatyczny używa pierwszej zmiany.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Zmiana Blue')).not.toBeInTheDocument();
  });

  it('does not show one static group when the assignment changes in the month', () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        employeeAssignments={[
          assignment(employee, 'RED', '2026-07-01', '2026-07-19'),
          assignment(employee, 'BLUE', '2026-07-20', null),
        ]}
        days={createCalendarDays('2026-07')}
        dailyValues={[]}
      />,
    );

    expect(screen.getByText('Zmiana zmienna')).toBeInTheDocument();
  });

  it('collapses and expands a department group without changing its count', () => {
    const secondEmployee: Employee = {
      ...employee,
      id: 'employee-2',
      tetaNumber: 'TETA-1002',
      firstName: 'Anna',
      lastName: 'Nowak',
    };
    render(
      <SettlementGrid
        employees={[employee, secondEmployee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[]}
      />,
    );

    const toggle = screen.getByRole('button', {
      name: 'Zwiń dział: Montaż Toyota',
    });
    expect(
      screen.getByTestId('settlement-department-group-montaz-toyota'),
    ).toHaveTextContent('2');
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
    expect(screen.queryByText('Anna Nowak')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Rozwiń dział: Montaż Toyota' }),
    );
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
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

  it('visibly marks a day-level manual schedule correction', () => {
    const scheduleCorrection: ScheduleCorrection = {
      id: 'employee-1_2026-06-03',
      monthId: '2026-06',
      employeeId: employee.id,
      tetaNumber: employee.tetaNumber,
      date: '2026-06-03',
      kind: 'NIGHT_SHIFT',
      plannedShift: 'NIGHT',
      plannedHours: 8,
      note: null,
      status: 'ACTIVE',
      ...metadata,
    };
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[]}
        scheduleCorrections={[scheduleCorrection]}
      />,
    );

    expect(
      screen.getByLabelText(
        'Ręczna korekta planu miesięcznego. Nie zmienia rzeczywistych godzin pracy.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an active DAY_OFF correction as 0 h in hours mode', () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-08')}
        dailyValues={[]}
        scheduleCorrections={[dayOffCorrection()]}
        displayMode="hours"
        onEditCell={vi.fn()}
      />,
    );

    const dayCell = screen.getByRole('button', {
      name: 'Edytuj dzień: Kowalski Jan, 2026-08-07',
    });
    expect(within(dayCell).getByText('0 h')).toBeInTheDocument();
    expect(within(dayCell).queryByText('8 h')).not.toBeInTheDocument();
  });

  it('shows an active DAY_OFF correction as a described day off in shifts mode', async () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-08')}
        dailyValues={[]}
        scheduleCorrections={[dayOffCorrection()]}
        displayMode="shifts"
        onEditCell={vi.fn()}
      />,
    );

    const dayCell = screen.getByRole('button', {
      name: 'Edytuj dzień: Kowalski Jan, 2026-08-07',
    });
    expect(within(dayCell).getByText('W')).toBeInTheDocument();
    expect(
      within(dayCell).getByLabelText(
        'Ręczna korekta planu miesięcznego. Nie zmienia rzeczywistych godzin pracy.',
      ),
    ).toBeInTheDocument();
    fireEvent.mouseOver(dayCell);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Wolne za święto',
    );
  });

  it('keeps day cells read-only in a settled month', () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-06')}
        dailyValues={[]}
        isSettled
        onEditCell={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: 'Edytuj dzień: Kowalski Jan, 2026-06-01',
      }),
    ).not.toBeInTheDocument();
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
    expect(screen.getByLabelText('Nadgodziny dzienne: 1 h')).toHaveTextContent(
      '+1h',
    );
    expect(screen.getByLabelText('Nadgodziny nocne: 2 h')).toHaveTextContent(
      '+2h',
    );
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.queryByText('2 h · noc')).not.toBeInTheDocument();
    expect(screen.getByText('11 h').parentElement?.parentElement).toHaveStyle({
      gridTemplateRows: '1.1rem 0.85rem',
    });
  });

  it('uses a sticky date header, sticky employee column and compact internal overflow', () => {
    render(
      <SettlementGrid
        employees={[employee]}
        departments={[department]}
        days={createCalendarDays('2026-07')}
        dailyValues={[]}
      />,
    );

    const container = screen.getByTestId('settlement-calendar-scroll');
    expect(container).toHaveStyle({ maxHeight: 'calc(100vh - 92px)' });
    expect(screen.getByText('Nazwisko i imię').closest('th')).toHaveStyle({
      position: 'sticky',
      left: '0px',
      top: '0px',
    });
  });
});

function assignment(
  worker: Employee,
  shiftAssignment: EmployeeAssignment['shiftAssignment'],
  validFrom: EmployeeAssignment['validFrom'],
  validTo: EmployeeAssignment['validTo'],
): EmployeeAssignment {
  return {
    id: `${worker.id}-${validFrom}-${shiftAssignment ?? 'none'}`,
    employeeId: worker.id,
    tetaNumber: worker.tetaNumber,
    departmentId: worker.departmentId,
    shiftAssignment,
    validFrom,
    validTo,
    status: 'ACTIVE',
    note: null,
    ...metadata,
  };
}

function dayOffCorrection(): ScheduleCorrection {
  return {
    id: `${employee.id}_2026-08-07`,
    monthId: '2026-08',
    employeeId: employee.id,
    tetaNumber: employee.tetaNumber,
    date: '2026-08-07',
    kind: 'DAY_OFF',
    plannedShift: null,
    plannedHours: 0,
    note: 'Wolne za święto',
    status: 'ACTIVE',
    ...metadata,
  };
}
