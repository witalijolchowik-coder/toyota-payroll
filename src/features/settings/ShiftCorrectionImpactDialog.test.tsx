import { fireEvent, render, screen } from '@testing-library/react';

import type {
  PlannedScheduleDay,
  ShiftCorrectionImpactSummary,
} from '../../utils/schedule';
import { ShiftCorrectionImpactDialog } from './ShiftCorrectionImpactDialog';

const plan = (shift: 'FIRST' | 'SECOND'): PlannedScheduleDay => ({
  employeeId: 'employee',
  date: '2026-07-08',
  status: 'WORKING',
  source: 'automatic',
  hours: 8,
  shift,
  label: shift,
  departmentId: 'metal',
  shiftAssignment: 'RED',
  reason: null,
  holidayName: null,
  plannedStartTime: shift === 'FIRST' ? '06:00' : '14:00',
  plannedEndTime: shift === 'FIRST' ? '14:00' : '22:00',
  plannedDuration: 8,
});

const impact: ShiftCorrectionImpactSummary = {
  departmentId: 'metal',
  effectiveDate: '2026-07-06',
  rangeStart: '2026-07-06',
  rangeEnd: '2026-07-14',
  boundedByNextCorrection: true,
  previousCorrectionId: 'previous',
  nextCorrectionId: 'next',
  employeeCount: 1,
  changedPlanDayCount: 1,
  manualActualCount: 1,
  overtimeCount: 1,
  shortageOrPrivateTimeCount: 0,
  absenceCount: 1,
  confirmedL4Count: 1,
  reviewRequiredCount: 1,
  details: [
    {
      employeeId: 'employee',
      employeeName: 'Kowalski Jan',
      tetaNumber: 'WT-1',
      date: '2026-07-08',
      before: plan('FIRST'),
      after: plan('SECOND'),
      hasManualActual: true,
      hasOvertime: true,
      hasShortageOrPrivateTime: false,
      hasAbsence: true,
      hasConfirmedL4: true,
      requiresReview: true,
    },
  ],
};

describe('ShiftCorrectionImpactDialog', () => {
  it('shows exact counts, expandable details and requires explicit apply', () => {
    const onApply = vi.fn();
    render(
      <ShiftCorrectionImpactDialog
        open
        departmentName="Metal"
        impact={impact}
        loading={false}
        applying={false}
        error={null}
        onCancel={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(screen.getByText('Wpływ korekty zmian')).toBeInTheDocument();
    expect(screen.getByText('Dni planu do przeliczenia')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(3);
    expect(screen.queryByText('Kowalski Jan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż szczegóły' }));
    expect(screen.getByText('Kowalski Jan')).toBeInTheDocument();
    expect(
      screen.getByText('Pierwsza zmiana · 06:00–14:00'),
    ).toBeInTheDocument();
    expect(screen.getByText('Druga zmiana · 14:00–22:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj korektę' }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('shows a calm zero-impact message and keeps saving available', () => {
    render(
      <ShiftCorrectionImpactDialog
        open
        departmentName="Metal"
        impact={{
          ...impact,
          employeeCount: 0,
          changedPlanDayCount: 0,
          details: [],
        }}
        loading={false}
        applying={false}
        error={null}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/nie zmieni się żaden plan dnia/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Zastosuj korektę' }),
    ).toBeEnabled();
  });

  it('keeps the preview open and shows a concrete write error', () => {
    render(
      <ShiftCorrectionImpactDialog
        open
        departmentName="Metal"
        impact={impact}
        loading={false}
        applying={false}
        error="Nie udało się zapisać korekty."
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Nie udało się zapisać korekty.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Wpływ korekty zmian')).toBeInTheDocument();
  });
});
