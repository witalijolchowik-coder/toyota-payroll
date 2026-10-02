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
