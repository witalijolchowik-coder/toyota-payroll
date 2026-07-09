import type { CalendarDay } from './monthUtils';
import {
  calendarConstructorBlockedReason,
  calendarToolOperation,
  datesInRangeSelection,
  isDateInRangeSelection,
  isSupportedCalendarConstructorTool,
  updateSingleEmployeeRangeSelection,
} from './calendarConstructor';

function day(isoDate: string): CalendarDay {
  return {
    date: new Date(`${isoDate}T00:00:00.000Z`),
    isoDate,
    dayOfMonth: Number(isoDate.slice(-2)),
    isWeekend: false,
    isHoliday: false,
    isWorkingDay: true,
    isFuture: false,
  };
}

describe('calendar constructor tool mapping', () => {
  it('maps supported tools to existing attendance or absence operations', () => {
    expect(calendarToolOperation('review')).toEqual({ kind: 'review' });
    expect(calendarToolOperation('hours')).toEqual({ kind: 'hours' });
    expect(calendarToolOperation('clear-manual')).toEqual({
      kind: 'clear-manual-attendance',
    });
    expect(calendarToolOperation('L4')).toEqual({
      kind: 'absence',
      absenceCode: 'L4',
    });
    expect(calendarToolOperation('UZ')).toEqual({
      kind: 'absence',
      absenceCode: 'UZ',
    });
  });

  it('recognizes only supported constructor tools', () => {
    expect(isSupportedCalendarConstructorTool('hours')).toBe(true);
    expect(isSupportedCalendarConstructorTool('OPD')).toBe(false);
    expect(isSupportedCalendarConstructorTool('calendar-status')).toBe(false);
  });
});

describe('calendar constructor range selection', () => {
  it('starts a single-employee range and expands it chronologically', () => {
    const first = updateSingleEmployeeRangeSelection({
      current: null,
      employeeId: 'employee-1',
      date: '2026-07-12',
    });
    const expanded = updateSingleEmployeeRangeSelection({
      current: first,
      employeeId: 'employee-1',
      date: '2026-07-08',
    });

    expect(expanded).toEqual({
      employeeId: 'employee-1',
      startDate: '2026-07-08',
      endDate: '2026-07-12',
    });
    expect(isDateInRangeSelection(expanded, 'employee-1', '2026-07-10')).toBe(
      true,
    );
    expect(isDateInRangeSelection(expanded, 'employee-2', '2026-07-10')).toBe(
      false,
    );
  });

  it('resets the range when another employee is selected', () => {
    const current = updateSingleEmployeeRangeSelection({
      current: null,
      employeeId: 'employee-1',
      date: '2026-07-08',
    });

    expect(
      updateSingleEmployeeRangeSelection({
        current,
        employeeId: 'employee-2',
        date: '2026-07-09',
      }),
    ).toEqual({
      employeeId: 'employee-2',
      startDate: '2026-07-09',
      endDate: '2026-07-09',
    });
  });

  it('returns calendar days contained in the selected range', () => {
    const days = [day('2026-07-07'), day('2026-07-08'), day('2026-07-09')];

    expect(
      datesInRangeSelection(days, {
        employeeId: 'employee-1',
        startDate: '2026-07-08',
        endDate: '2026-07-09',
      }).map((item) => item.isoDate),
    ).toEqual(['2026-07-08', '2026-07-09']);
  });
});

describe('calendar constructor guards', () => {
  it('keeps review mode available in settled months', () => {
    expect(
      calendarConstructorBlockedReason({
        isSettled: true,
        selectedTool: 'review',
        containsOutsideEmployment: true,
      }),
    ).toBeNull();
  });

  it('blocks write tools in settled months and outside employment', () => {
    expect(
      calendarConstructorBlockedReason({
        isSettled: true,
        selectedTool: 'hours',
        containsOutsideEmployment: false,
      }),
    ).toBe('settled-month');
    expect(
      calendarConstructorBlockedReason({
        isSettled: false,
        selectedTool: 'L4',
        containsOutsideEmployment: true,
      }),
    ).toBe('outside-employment');
  });
});
