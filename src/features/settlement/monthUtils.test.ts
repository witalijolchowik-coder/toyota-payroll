import type { DailyValue, Employee } from '../../types/firestore';
import {
  createCalendarDays,
  currentMonthId,
  employeeParticipatesInMonth,
  formatMonthId,
  getMonthDateRange,
  parseMonthId,
  previousMonthId,
  resolveSettlementCellValue,
} from './monthUtils';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 'test-user',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: 'test-user',
};

function employee(overrides: Partial<Employee> = {}): Employee {
  const start = Object.hasOwn(overrides, 'employmentStartDate')
    ? (overrides.employmentStartDate ?? null)
    : new Date('2026-01-01T00:00:00.000Z');
  const end = Object.hasOwn(overrides, 'employmentEndDate')
    ? (overrides.employmentEndDate ?? null)
    : null;
  return {
    id: 'employee-1',
    tetaNumber: 'TETA-1001',
    firstName: 'Jan',
    lastName: 'Kowalski',
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: start,
    employmentEndDate: end,
    ...metadata,
    ...overrides,
    pesel: overrides.pesel ?? null,
    passportNumber: overrides.passportNumber ?? null,
    foreignDocumentNumber: overrides.foreignDocumentNumber ?? null,
    contracts:
      overrides.contracts ??
      (start
        ? [
            {
              id: 'contract-1',
              employeeId: overrides.id ?? 'employee-1',
              tetaNumber: overrides.tetaNumber ?? 'TETA-1001',
              sequenceId: 'sequence-1',
              startDate: start.toISOString().slice(0, 10),
              endDate: end?.toISOString().slice(0, 10) ?? null,
              status: 'ACTIVE',
              note: null,
              ...metadata,
            },
          ]
        : []),
  };
}

describe('payroll month identifiers and date ranges', () => {
  it('formats, parses, and derives month IDs', () => {
    expect(formatMonthId(2026, 7)).toBe('2026-07');
    expect(parseMonthId('2026-07')).toEqual({ year: 2026, month: 7 });
    expect(currentMonthId(new Date(2026, 6, 2))).toBe('2026-07');
    expect(previousMonthId(new Date(2026, 6, 2))).toBe('2026-06');
    expect(previousMonthId(new Date(2026, 0, 10))).toBe('2025-12');
  });

  it('rejects malformed month IDs and month numbers', () => {
    expect(() => parseMonthId('07-2026')).toThrow();
    expect(() => parseMonthId('2026-13')).toThrow();
    expect(() => parseMonthId('0000-01')).toThrow();
    expect(() => formatMonthId(2026, 0)).toThrow();
  });

  it('creates an inclusive range for a leap-year February', () => {
    const range = getMonthDateRange('2024-02');
    expect(range.start.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2024-02-29T23:59:59.999Z');
  });
});

describe('payroll-period employee participation', () => {
  const june = getMonthDateRange('2026-06');

  it('includes an inactive employee whose employment ended during the month', () => {
    expect(
      employeeParticipatesInMonth(
        employee({
          isActive: false,
          employmentEndDate: new Date('2026-06-15T00:00:00.000Z'),
        }),
        june,
      ),
    ).toBe(true);
  });

  it('excludes employment periods outside the selected month', () => {
    expect(
      employeeParticipatesInMonth(
        employee({
          employmentStartDate: new Date('2026-07-01T00:00:00.000Z'),
        }),
        june,
      ),
    ).toBe(false);
    expect(
      employeeParticipatesInMonth(
        employee({
          employmentEndDate: new Date('2026-05-31T23:59:59.999Z'),
        }),
        june,
      ),
    ).toBe(false);
  });

  it('does not infer participation from current status when start date is missing', () => {
    expect(
      employeeParticipatesInMonth(
        employee({ isActive: true, employmentStartDate: null }),
        june,
      ),
    ).toBe(false);
  });
});

describe('virtual daily values', () => {
  const employeeRecord = employee();
  const calendar = createCalendarDays('2026-07', {
    today: new Date(2026, 6, 15),
  });

  it('shows virtual 8h for a past working day without a persisted value', () => {
    const workingDay = calendar.find((day) => day.isoDate === '2026-07-14')!;
    expect(
      resolveSettlementCellValue({
        employee: employeeRecord,
        day: workingDay,
      }),
    ).toEqual({
      kind: 'virtual-default',
      calendarState: 'working',
      hours: 8,
      fallbackHours: 8,
      coordinatorNote: null,
    });
  });

  it('includes the current working day in virtual defaults', () => {
    const today = calendar.find((day) => day.isoDate === '2026-07-15')!;
    expect(
      resolveSettlementCellValue({ employee: employeeRecord, day: today }),
    ).toEqual({
      kind: 'virtual-default',
      calendarState: 'working',
      hours: 8,
      fallbackHours: 8,
      coordinatorNote: null,
    });
  });

  it('keeps future working days and weekends empty', () => {
    const futureDay = calendar.find((day) => day.isoDate === '2026-07-16')!;
    const weekend = calendar.find((day) => day.isoDate === '2026-07-12')!;

    expect(
      resolveSettlementCellValue({ employee: employeeRecord, day: futureDay }),
    ).toEqual({
      kind: 'empty',
      calendarState: 'future',
      hours: null,
      fallbackHours: null,
      coordinatorNote: null,
    });
    expect(
      resolveSettlementCellValue({ employee: employeeRecord, day: weekend }),
    ).toEqual({
      kind: 'virtual-default',
      calendarState: 'non-working',
      hours: 0,
      fallbackHours: 0,
      coordinatorNote: null,
    });
  });

  it('supports public-holiday placeholders as non-working days', () => {
    const holidayCalendar = createCalendarDays('2026-07', {
      today: new Date(2026, 6, 15),
      publicHolidays: new Set(['2026-07-14']),
    });
    const holiday = holidayCalendar.find(
      (day) => day.isoDate === '2026-07-14',
    )!;

    expect(holiday).toMatchObject({
      isHoliday: true,
      isWorkingDay: false,
    });
    expect(
      resolveSettlementCellValue({ employee: employeeRecord, day: holiday }),
    ).toEqual({
      kind: 'virtual-default',
      calendarState: 'non-working',
      hours: 0,
      fallbackHours: 0,
      coordinatorNote: null,
    });
  });

  it('uses a persisted value before the virtual default', () => {
    const day = calendar.find((item) => item.isoDate === '2026-07-14')!;
    const persistedValue = {
      id: 'employee-1_2026-07-14',
      monthId: '2026-07',
      employeeId: 'employee-1',
      tetaNumber: 'TETA-1001',
      date: '2026-07-14',
      hours: 6,
      source: 'manual',
      importId: null,
      note: null,
      manualOverride: null,
      ...metadata,
    } satisfies DailyValue;

    expect(
      resolveSettlementCellValue({
        employee: employeeRecord,
        day,
        persistedValue,
      }),
    ).toEqual({
      kind: 'manual',
      calendarState: 'working',
      hours: 6,
      fallbackHours: 8,
      coordinatorNote: null,
    });
  });

  it('distinguishes an imported persisted value', () => {
    const day = calendar.find((item) => item.isoDate === '2026-07-14')!;
    const importedValue = {
      id: 'employee-1_2026-07-14',
      monthId: '2026-07',
      employeeId: 'employee-1',
      tetaNumber: 'TETA-1001',
      date: '2026-07-14',
      hours: 7,
      source: 'attendance_import',
      importId: 'import-1',
      note: null,
      manualOverride: null,
      ...metadata,
    } satisfies DailyValue;

    expect(
      resolveSettlementCellValue({
        employee: employeeRecord,
        day,
        persistedValue: importedValue,
      }),
    ).toEqual({
      kind: 'imported',
      calendarState: 'working',
      hours: 7,
      fallbackHours: 7,
      coordinatorNote: null,
    });
  });

  it('uses a manual override while preserving the imported fallback', () => {
    const day = calendar.find((item) => item.isoDate === '2026-07-14')!;
    const importedValue = {
      id: 'employee-1_2026-07-14',
      monthId: '2026-07',
      employeeId: 'employee-1',
      tetaNumber: 'TETA-1001',
      date: '2026-07-14',
      hours: 7,
      source: 'attendance_import',
      importId: 'import-1',
      note: null,
      manualOverride: {
        hours: 8.5,
        note: 'Korekta',
        actorUid: 'coordinator-1',
        updatedAt: new Date('2026-07-15T08:00:00.000Z'),
      },
      ...metadata,
    } satisfies DailyValue;

    expect(
      resolveSettlementCellValue({
        employee: employeeRecord,
        day,
        persistedValue: importedValue,
      }),
    ).toEqual({
      kind: 'imported-override',
      calendarState: 'working',
      hours: 8.5,
      fallbackHours: 7,
      coordinatorNote: 'Korekta',
    });
  });

  it('does not show a virtual default outside the employment period', () => {
    const day = calendar.find((item) => item.isoDate === '2026-07-14')!;
    expect(
      resolveSettlementCellValue({
        employee: employee({
          employmentStartDate: new Date('2026-07-20T00:00:00.000Z'),
        }),
        day,
      }),
    ).toEqual({
      kind: 'empty',
      calendarState: 'outside-employment',
      hours: null,
      fallbackHours: null,
      coordinatorNote: null,
    });
  });
});
