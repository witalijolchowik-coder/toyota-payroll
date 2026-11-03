import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrigadeCalendarPanel } from './BrigadeCalendarPanel';
import { saveBrigadeScheduleDays } from '../../services/brigadeScheduleService';
import type { Department } from '../../types/firestore';
vi.mock('../../services/brigadeScheduleService', () => ({
  saveBrigadeScheduleDays: vi.fn(async () => {}),
}));
const department: Department = {
  id: 'headliner-bmw',
  name: 'Headliner BMW',
  active: true,
  shiftMode: 'THREE_SHIFT',
  brigadeSchedulingFrom: '2026-10-01',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'test',
  updatedBy: 'test',
};
describe('brigade calendar constructor', () => {
  it('saves a date-specific twelve-hour plan and reloads the displayed record', async () => {
    const reload = vi.fn(async () => {});
    const props = {
      monthId: '2026-10',
      departments: [department],
      employees: [],
      assignments: [],
      plans: [],
      locked: false,
      onReload: reload,
    };
    const view = render(<BrigadeCalendarPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguruj plan' }));
    fireEvent.change(screen.getByLabelText('Data od'), {
      target: { value: '2026-10-03' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz plan' }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(saveBrigadeScheduleDays).toHaveBeenCalledWith([
      expect.objectContaining({
        date: '2026-10-03',
        kind: 'DAY',
        plannedHours: 12,
        startTime: '06:00',
        endTime: '18:00',
        employeeId: null,
        brigade: 'WHITE',
      }),
    ]);
    view.rerender(
      <BrigadeCalendarPanel
        {...props}
        plans={[
          {
            id: 'saved',
            date: '2026-10-03',
            kind: 'DAY',
            plannedHours: 12,
            startTime: '06:00',
            endTime: '18:00',
            employeeId: null,
            brigade: 'WHITE',
            departmentId: department.id,
            status: 'ACTIVE',
            note: null,
          },
        ]}
      />,
    );
    expect(screen.getByText(/Zapis na 2026-10-03: DAY, 12 h/)).toBeVisible();
  });
  it('does not expose an editor for non-opted-in departments', () => {
    const { container } = render(
      <BrigadeCalendarPanel
        monthId="2026-10"
        departments={[{ ...department, brigadeSchedulingFrom: undefined }]}
        employees={[]}
        assignments={[]}
        plans={[]}
        locked={false}
        onReload={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
  it('protects locked months', () => {
    render(
      <BrigadeCalendarPanel
        monthId="2026-10"
        departments={[department]}
        employees={[]}
        assignments={[]}
        plans={[]}
        locked
        onReload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguruj plan' }));
    expect(screen.getByRole('button', { name: 'Zapisz plan' })).toBeDisabled();
  });
});
