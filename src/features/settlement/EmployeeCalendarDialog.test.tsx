import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { Absence } from '../../types/firestore';
import {
  balanceDaily,
  balanceEmployee,
  balanceFacts,
} from '../../utils/attendance/balanceFixtures.test-support';
import { createCalendarDays } from './monthUtils';
import { EmployeeCalendarDialog } from './EmployeeCalendarDialog';
import type { PlannedScheduleDay } from '../../utils/schedule';
import { generateEmployeeMonthlySchedule } from '../../utils/schedule';
import { october2026Schedule } from '../../utils/schedule/october2026.test-support';
import { compactBrigadeShiftLabel } from './compactBrigadeShiftLabel';

it('renders a colorless individual plan with its own shift codes and 148 planned hours', () => {
  const employee = { ...balanceEmployee(), departmentId: 'utrzymanie-ruchu' };
  const department = {
    id: employee.departmentId,
    name: 'Utrzymanie Ruchu',
    shiftMode: 'UNKNOWN' as const,
    active: true,
    individualSchedulingOnly: true,
    brigadeSchedulingFrom: '2026-10-01',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test',
    updatedBy: 'test',
  };
  const days = createCalendarDays('2026-10', { today: new Date('2026-11-04') });
  const plannedSchedule = generateEmployeeMonthlySchedule({
    employee,
    days,
    departments: [department],
    options: { brigadeScheduleDays: october2026Schedule(null, employee.id) },
  });
  render(
    <EmployeeCalendarDialog
      employee={employee}
      monthLabel="październik 2026"
      days={days}
      dailyValues={[]}
      absences={[]}
      departments={[department]}
      employeeAssignments={[]}
      isSettled={false}
      onClose={vi.fn()}
      onEditDay={vi.fn()}
      plannedSchedule={plannedSchedule}
    />,
  );
  expect(screen.getByText('Plan indywidualny: 148 h')).toBeVisible();
  expect(screen.getAllByText(/^II ·/)).toHaveLength(2);
  expect(screen.getAllByText(/^I ·/)).toHaveLength(15);
  expect(screen.getByText(/^N12 ·/)).toBeVisible();
  expect(screen.getByText('WN')).toBeVisible();
  expect(screen.queryByText(/Brak grupy · plan/)).not.toBeInTheDocument();
});

it.each([
  ['FIRST', '06:00', '18:00', 'D12'],
  ['NIGHT', '18:00', '06:00', 'N12'],
] as const)(
  'labels a 12-hour %s plan in the personal calendar',
  (shift, start, end, label) => {
    const employee = balanceEmployee();
    const date = '2026-09-10';
    const plannedDay: PlannedScheduleDay = {
      employeeId: employee.id,
      date,
      status: 'WORKING',
      source: 'calendar',
      brigadeScheduled: true,
      hours: 12,
      plannedDuration: 12,
      shift,
      plannedStartTime: start,
      plannedEndTime: end,
      label: 'legacy',
      departmentId: employee.departmentId,
      shiftAssignment: employee.shiftAssignment,
      reason: null,
      holidayName: null,
    };
    render(
      <EmployeeCalendarDialog
        employee={employee}
        monthLabel="wrzesień 2026"
        days={createCalendarDays('2026-09', {
          today: new Date('2026-10-01'),
        }).filter((d) => d.isoDate === date)}
        dailyValues={[]}
        absences={[]}
        departments={[]}
        employeeAssignments={[]}
        isSettled={false}
        onClose={vi.fn()}
        onEditDay={vi.fn()}
        plannedSchedule={[plannedDay]}
      />,
    );
    expect(screen.getByText(new RegExp(`^${label} ·`))).toBeInTheDocument();
    expect(
      compactBrigadeShiftLabel({
        ...plannedDay,
        status: 'DAY_OFF',
        label: 'N',
        hours: 0,
      }),
    ).toBeNull();
  },
);

it('shows manual UW instead of suppressed Balance work in the personal calendar', () => {
  const employee = balanceEmployee();
  const attendance = balanceDaily(
    '2026-09-10',
    balanceFacts({
      credited_hours: 10,
      extra_hours: 2,
      actual_end_time: '16:00',
      presence_hours: 10,
    }),
  );
  const absence: Absence = {
    id: 'manual-uw',
    employeeId: employee.id,
    tetaNumber: employee.tetaNumber,
    monthId: '2026-09',
    absenceCode: 'UW',
    startDate: attendance.date,
    endDate: attendance.date,
    hoursPerDay: null,
    source: 'manual',
    importId: null,
    status: 'ACTIVE',
    note: null,
    createdAt: attendance.createdAt,
    createdBy: 'test',
    updatedAt: attendance.updatedAt,
    updatedBy: 'test',
  };
  const props = {
    employee,
    monthLabel: 'wrzesień 2026',
    dailyValues: [attendance],
    days: createCalendarDays('2026-09', {
      today: new Date('2026-10-01'),
    }).filter((day) => day.isoDate === attendance.date),
    departments: [],
    employeeAssignments: [],
    isSettled: false,
    onClose: vi.fn(),
    onEditDay: vi.fn(),
  };
  const { rerender } = render(
    <EmployeeCalendarDialog {...props} absences={[absence]} />,
  );
  expect(screen.getByText('UW')).toBeInTheDocument();
  expect(screen.queryByText('10 h')).not.toBeInTheDocument();
  rerender(
    <EmployeeCalendarDialog
      {...props}
      absences={[{ ...absence, status: 'CANCELLED' }]}
    />,
  );
  expect(screen.queryByText('UW')).not.toBeInTheDocument();
  expect(screen.getByText('10 h')).toBeInTheDocument();
  expect(attendance.hours).toBe(10);
});
