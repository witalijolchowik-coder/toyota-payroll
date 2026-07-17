import { describe, expect, it } from 'vitest';

import type { Department, Employee } from '../../types/firestore';
import {
  aggregateMedicalNotices,
  deriveEmployeeMedicalStatus,
  expectedMedicalTypeForDepartment,
  normalizeCitizenship,
  normalizeMedicalExaminationType,
  normalizePhoneNumber,
} from './employeeMedical';

describe('employee medical and contact helpers', () => {
  it.each([
    ['Metal', 'PRODUKCJA'],
    ['Montaż', 'PRODUKCJA'],
    ['Szwalnia', 'PRODUKCJA'],
    ['Magazyn', 'MAGAZYNIER'],
    ['Headliner', 'PRODUKCJA_HL_PU'],
    ['PU', 'PRODUKCJA_HL_PU'],
  ])('maps %s to the expected medical type', (department, expected) => {
    expect(expectedMedicalTypeForDepartment(department)).toBe(expected);
  });

  it('normalizes supported Polish medical labels without guessing', () => {
    expect(normalizeMedicalExaminationType(' pracownik produkcji ')).toBe(
      'PRODUKCJA',
    );
    expect(normalizeMedicalExaminationType('MAGAZYNIER')).toBe('MAGAZYNIER');
    expect(normalizeMedicalExaminationType('Pracownik produkcji HL/PU')).toBe(
      'PRODUKCJA_HL_PU',
    );
    expect(normalizeMedicalExaminationType('Biuro')).toBeNull();
  });

  it('preserves international phone prefixes and normalizes spaces only', () => {
    expect(normalizePhoneNumber('  +48  500 000 000  ')).toBe(
      '+48 500 000 000',
    );
    expect(normalizePhoneNumber('+380  050-123-45-67')).toBe(
      '+380 050-123-45-67',
    );
    expect(normalizePhoneNumber('0123 456')).toBe('0123 456');
  });

  it('normalizes valid ISO citizenship and rejects unknown codes', () => {
    expect(normalizeCitizenship('pl')).toBe('PL');
    expect(normalizeCitizenship(' Ua ')).toBe('UA');
    expect(normalizeCitizenship('BY')).toBe('BY');
    expect(normalizeCitizenship('XX')).toBeNull();
    expect(normalizeCitizenship('POL')).toBeNull();
  });

  it.each([
    ['2026-07-16', 'expired', -1],
    ['2026-07-17', 'expiring-soon', 0],
    ['2026-07-27', 'expiring-soon', 10],
    ['2026-07-28', 'valid', 11],
  ])(
    'derives deterministic expiration status for %s',
    (validUntil, expected, daysRemaining) => {
      const status = deriveEmployeeMedicalStatus(
        {
          medicalExaminationDate: date('2026-01-01'),
          medicalValidUntil: date(validUntil),
          medicalExaminationType: 'PRODUKCJA',
        },
        'Metal',
        new Date('2026-07-17T12:00:00+02:00'),
      );

      expect(status.primary).toBe(expected);
      expect(status.daysRemaining).toBe(daysRemaining);
    },
  );

  it('keeps missing data and department mismatch as separate issues', () => {
    const missing = deriveEmployeeMedicalStatus(
      {},
      'Metal',
      date('2026-07-17'),
    );
    const mismatch = deriveEmployeeMedicalStatus(
      {
        medicalExaminationDate: date('2026-01-01'),
        medicalValidUntil: date('2027-01-01'),
        medicalExaminationType: 'PRODUKCJA',
      },
      'Magazyn',
      date('2026-07-17'),
    );

    expect(missing.issues).toEqual(
      expect.arrayContaining(['missing-data', 'missing-validity']),
    );
    expect(mismatch.primary).toBe('valid');
    expect(mismatch.issues).toContain('department-mismatch');
  });

  it('aggregates dashboard notices from the canonical status helper', () => {
    const employees = [
      employee('expired', date('2026-07-16'), 'PRODUKCJA', 'metal'),
      employee('soon', date('2026-07-27'), 'MAGAZYNIER', 'warehouse'),
      employee('mismatch', date('2027-01-01'), 'PRODUKCJA', 'warehouse'),
      employee('missing', null, null, 'metal'),
    ];
    const summary = aggregateMedicalNotices(
      employees,
      [department('metal', 'Metal'), department('warehouse', 'Magazyn')],
      date('2026-07-17'),
    );

    expect(summary.expired.map((item) => item.id)).toEqual(['expired']);
    expect(summary.expiringSoon.map((item) => item.id)).toEqual(['soon']);
    expect(summary.incompatible.map((item) => item.id)).toEqual(['mismatch']);
    expect(summary.missingValidity.map((item) => item.id)).toEqual(['missing']);
  });
});

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function employee(
  id: string,
  medicalValidUntil: Date | null,
  medicalExaminationType: Employee['medicalExaminationType'],
  departmentId: string,
): Employee {
  const now = date('2026-01-01');
  return {
    id,
    tetaNumber: `WT-${id}`,
    firstName: 'Jan',
    lastName: 'Testowy',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId,
    shiftAssignment: null,
    employmentStartDate: now,
    employmentEndDate: null,
    medicalExaminationDate: medicalValidUntil ? now : null,
    medicalValidUntil,
    medicalExaminationType,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}

function department(id: string, name: string): Department {
  const now = date('2026-01-01');
  return {
    id,
    name,
    shiftMode: 'THREE_SHIFT',
    active: true,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
