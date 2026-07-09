import type { DailyValue } from '../../types/firestore';
import {
  isValidWorkedHours,
  resolveManualAttendanceClearOperation,
  resolveAttendanceWarnings,
  resolveEffectiveAttendanceValue,
} from './attendanceRules';

const metadata = {
  createdAt: new Date('2026-07-01T08:00:00.000Z'),
  createdBy: 'system',
  updatedAt: new Date('2026-07-02T08:00:00.000Z'),
  updatedBy: 'coordinator-1',
};

function dailyValue(overrides: Partial<DailyValue> = {}): DailyValue {
  return {
    id: 'employee-1_2026-07-02',
    monthId: '2026-07',
    employeeId: 'employee-1',
    tetaNumber: 'TETA-1001',
    date: '2026-07-02',
    hours: 7,
    source: 'attendance_import',
    importId: 'import-1',
    note: null,
    manualOverride: null,
    ...metadata,
    ...overrides,
  };
}

describe('effective attendance values', () => {
  it('uses the original explicit value when no override exists', () => {
    expect(resolveEffectiveAttendanceValue(dailyValue())).toEqual({
      kind: 'imported',
      hours: 7,
      originalHours: 7,
      note: null,
    });
  });

  it('uses a manual correction without losing the imported value', () => {
    expect(
      resolveEffectiveAttendanceValue(
        dailyValue({
          manualOverride: {
            hours: 8.5,
            note: 'Korekta koordynatora',
            actorUid: 'coordinator-1',
            updatedAt: new Date('2026-07-02T08:00:00.000Z'),
          },
        }),
      ),
    ).toEqual({
      kind: 'imported-override',
      hours: 8.5,
      originalHours: 7,
      note: 'Korekta koordynatora',
    });
  });

  it('keeps ordinary manual values distinct from imported corrections', () => {
    expect(
      resolveEffectiveAttendanceValue(
        dailyValue({
          hours: 6,
          source: 'manual',
          importId: null,
          note: 'Ręczny wpis',
        }),
      ),
    ).toEqual({
      kind: 'manual',
      hours: 6,
      originalHours: 6,
      note: 'Ręczny wpis',
    });
  });
});

describe('attendance warnings', () => {
  it('flags explicit hours covered by an absence without dropping the fact', () => {
    expect(
      resolveAttendanceWarnings({
        hasExplicitValue: true,
        hasActiveAbsence: true,
        isWorkingDay: true,
        isWithinEmployment: true,
      }),
    ).toEqual(['absence-conflict']);
  });

  it('flags non-working and outside-employment facts independently', () => {
    expect(
      resolveAttendanceWarnings({
        hasExplicitValue: true,
        hasActiveAbsence: false,
        isWorkingDay: false,
        isWithinEmployment: false,
      }),
    ).toEqual(['non-working-explicit', 'outside-employment']);
  });

  it('does not warn for virtual defaults or empty cells', () => {
    expect(
      resolveAttendanceWarnings({
        hasExplicitValue: false,
        hasActiveAbsence: true,
        isWorkingDay: false,
        isWithinEmployment: false,
      }),
    ).toEqual([]);
  });
});

describe('worked-hours validation', () => {
  it('accepts decimal values from 0 through 24', () => {
    expect(isValidWorkedHours(0)).toBe(true);
    expect(isValidWorkedHours(7.5)).toBe(true);
    expect(isValidWorkedHours(24)).toBe(true);
  });

  it('rejects non-finite, negative, and above-24 values', () => {
    expect(isValidWorkedHours(Number.NaN)).toBe(false);
    expect(isValidWorkedHours(-0.01)).toBe(false);
    expect(isValidWorkedHours(24.01)).toBe(false);
  });
});

describe('manual attendance clearing', () => {
  it('deletes standalone manual values', () => {
    expect(
      resolveManualAttendanceClearOperation({
        source: 'manual',
        manualOverride: null,
      }),
    ).toBe('delete-manual-daily-value');
  });

  it('clears only manual overrides on imported values', () => {
    expect(
      resolveManualAttendanceClearOperation({
        source: 'attendance_import',
        manualOverride: {
          hours: 6,
          note: 'Korekta',
          actorUid: 'coordinator-1',
          updatedAt: new Date('2026-07-02T08:00:00.000Z'),
        },
      }),
    ).toBe('clear-imported-override');
  });

  it('preserves imported values without an override', () => {
    expect(
      resolveManualAttendanceClearOperation({
        source: 'attendance_import',
        manualOverride: null,
      }),
    ).toBe('preserve-imported-value');
    expect(resolveManualAttendanceClearOperation(null)).toBe('noop');
  });
});
