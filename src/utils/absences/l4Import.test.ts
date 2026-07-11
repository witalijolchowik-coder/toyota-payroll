import { describe, expect, it } from 'vitest';

import type { Absence, Employee } from '../../types/firestore';
import {
  buildL4ImportPreview,
  parseL4DateCell,
  resolveL4ImportPreviewRow,
  type L4ImportSourceRow,
} from './l4Import';

const metadata = {
  createdAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'test',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  updatedBy: 'test',
};

function employee(
  id: string,
  firstName: string,
  lastName: string,
  tetaNumber: string,
): Employee {
  return {
    ...metadata,
    id,
    firstName,
    lastName,
    tetaNumber,
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: new Date('2026-01-01T00:00:00Z'),
    employmentEndDate: null,
  };
}

function row(overrides: Partial<L4ImportSourceRow> = {}): L4ImportSourceRow {
  return {
    rowNumber: 2,
    sourceName: 'KOWALSKI JAN',
    absenceType: 'L4',
    startDate: '2026-07-08',
    endDate: '2026-07-10',
    errors: [],
    ...overrides,
  };
}

function absence(overrides: Partial<Absence> = {}): Absence {
  return {
    ...metadata,
    id: 'absence-1',
    monthId: '2026-07',
    employeeId: 'employee-1',
    tetaNumber: '100',
    absenceCode: 'L4',
    startDate: '2026-07-08',
    endDate: '2026-07-10',
    hoursPerDay: null,
    source: 'manual',
    importId: null,
    status: 'ACTIVE',
    note: null,
    ...overrides,
  };
}

describe('L4 import helpers', () => {
  it('parses Polish date text and rejects invalid calendar dates', () => {
    expect(parseL4DateCell('08.07.2026')).toBe('2026-07-08');
    expect(parseL4DateCell('29.02.2024')).toBe('2024-02-29');
    expect(parseL4DateCell('29.02.2026')).toBeNull();
  });

  it('matches surname-first names without removing Polish characters', () => {
    const preview = buildL4ImportPreview([row({ sourceName: 'ŻÓŁĆ ANNA' })], {
      employees: [employee('employee-1', 'Anna', 'Żółć', '100')],
      existingAbsences: [],
      existingMonthIds: new Set(['2026-07']),
    });

    expect(preview[0]).toMatchObject({
      status: 'ready',
      employeeId: 'employee-1',
      tetaNumber: '100',
    });
  });

  it('blocks ambiguous and unmatched rows from automatic import', () => {
    const employees = [
      employee('employee-1', 'Jan', 'Kowalski', '100'),
      employee('employee-2', 'Jan', 'Kowalski', '200'),
    ];

    expect(
      buildL4ImportPreview([row()], {
        employees,
        existingAbsences: [],
        existingMonthIds: new Set(['2026-07']),
      })[0]?.status,
    ).toBe('ambiguous');
    expect(
      buildL4ImportPreview([row({ sourceName: 'NOWAK JAN' })], {
        employees,
        existingAbsences: [],
        existingMonthIds: new Set(['2026-07']),
      })[0]?.status,
    ).toBe('unmatched');
  });

  it('skips exact duplicates and sends overlaps or continuations to review', () => {
    const employees = [employee('employee-1', 'Jan', 'Kowalski', '100')];
    const context = {
      employees,
      existingAbsences: [absence()],
      existingMonthIds: new Set(['2026-07']),
    };

    expect(buildL4ImportPreview([row()], context)[0]?.status).toBe('duplicate');
    expect(
      buildL4ImportPreview(
        [row({ startDate: '2026-07-09', endDate: '2026-07-12' })],
        context,
      )[0]?.status,
    ).toBe('overlap-review');
    expect(
      buildL4ImportPreview(
        [row({ startDate: '2026-07-11', endDate: '2026-07-12' })],
        context,
      )[0]?.status,
    ).toBe('continuation-review');
  });

  it('requires the owner month to exist before creating a cross-month L4', () => {
    const preview = buildL4ImportPreview(
      [row({ startDate: '2026-06-28', endDate: '2026-07-05' })],
      {
        employees: [employee('employee-1', 'Jan', 'Kowalski', '100')],
        existingAbsences: [],
        existingMonthIds: new Set(['2026-07']),
      },
    );

    expect(preview[0]).toMatchObject({
      status: 'month-missing',
      ownerMonthId: '2026-06',
    });
  });

  it('rechecks manually resolved employees before allowing L4 creation', () => {
    const context = {
      employees: [employee('employee-1', 'Jan', 'Kowalski', '100')],
      existingAbsences: [],
      existingMonthIds: new Set(['2026-07']),
    };
    const unmatched = buildL4ImportPreview(
      [row({ sourceName: 'RAPORTOWE NAZWISKO' })],
      context,
    )[0]!;

    expect(unmatched.status).toBe('unmatched');
    expect(
      resolveL4ImportPreviewRow(unmatched, 'employee-1', context),
    ).toMatchObject({
      status: 'ready',
      employeeId: 'employee-1',
      tetaNumber: '100',
    });
  });

  it('keeps manual L4 resolution in review when existing active absence overlaps', () => {
    const context = {
      employees: [employee('employee-1', 'Jan', 'Kowalski', '100')],
      existingAbsences: [
        absence({ startDate: '2026-07-09', endDate: '2026-07-11' }),
      ],
      existingMonthIds: new Set(['2026-07']),
    };
    const unmatched = buildL4ImportPreview(
      [row({ sourceName: 'RAPORTOWE NAZWISKO' })],
      context,
    )[0]!;

    expect(
      resolveL4ImportPreviewRow(unmatched, 'employee-1', context),
    ).toMatchObject({
      status: 'overlap-review',
      employeeId: 'employee-1',
      tetaNumber: '100',
    });
  });
});
