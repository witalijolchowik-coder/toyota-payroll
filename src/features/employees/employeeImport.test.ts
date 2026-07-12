import { describe, expect, it } from 'vitest';

import type { Department, Employee } from '../../types/firestore';
import {
  buildEmployeeImportPreview,
  parseSozRowsFromCsv,
  parseToyotaEmployeeRowsFromMatrix,
} from './employeeImport';

describe('employee import foundation', () => {
  it('parses Toyota employee rows without importing payroll hour columns', () => {
    const rows = parseToyotaEmployeeRowsFromMatrix([
      [
        'Nazwisko',
        'Imię',
        'Numer personalny',
        'Agencja',
        'Jednostka organizacyjna/Dział',
        'Stanowisko',
        'Stawka',
        'Data zatrudnienia',
        'Data zwolnienia',
        'Godziny łącznie',
      ],
      [
        'Kowalska',
        'Anna',
        ' wt-001 ',
        'PS',
        'METAL',
        'Operator',
        30,
        '2026-06-03',
        '',
        168,
      ],
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        firstName: 'Anna',
        lastName: 'Kowalska',
        tetaNumber: 'WT-001',
        departmentName: 'METAL',
      }),
    ]);
    expect(rows[0].employmentStartDate?.toISOString().slice(0, 10)).toBe(
      '2026-06-03',
    );
  });

  it('parses SOZ PL and UA identity and housing hints', () => {
    const plRows = parseSozRowsFromCsv(
      [
        'Nazwisko;Imię;Paszport / PESEL;Dodatek za mieszkanie od spółki / Kwota',
        'Kowalska;Anna;81010112345;250,50',
      ].join('\n'),
      'soz-pl',
    );
    const uaRows = parseSozRowsFromCsv(
      [
        'Nazwisko;Imię;Paszport / PESEL;Media / Kwota;Mieszkanie / Kwota',
        'Boiko;Anna;GN142425;500,00;150,00',
      ].join('\n'),
      'soz-ua',
    );

    expect(plRows[0]).toMatchObject({
      identityNumber: '81010112345',
      ownHousingAllowanceAmount: 250.5,
    });
    expect(uaRows[0]).toMatchObject({
      identityNumber: 'GN142425',
      companyHousingMediaAmount: 500,
      companyHousingAccommodationAmount: 150,
    });
  });

  it('creates selectable new candidates and enriches identity from matching SOZ rows', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          source: 'toyota',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          tetaNumber: 'WT-001',
          departmentName: 'METAL',
          employmentStartDate: date('2026-06-03'),
          employmentEndDate: null,
        },
      ],
      sozRows: [
        {
          source: 'soz-pl',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          identityNumber: '81010112345',
          companyHousingMediaAmount: 0,
          companyHousingAccommodationAmount: 0,
          ownHousingAllowanceAmount: 0,
        },
      ],
      existingEmployees: [],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview).toHaveLength(1);
    expect(preview[0]).toMatchObject({
      status: 'new',
      tetaNumber: 'WT-001',
      pesel: '81010112345',
      departmentId: 'metal',
    });
    expect(preview[0].createInput).toMatchObject({
      tetaNumber: 'WT-001',
      pesel: '81010112345',
      shiftAssignment: null,
    });
  });

  it('does not create rows for existing employees with the same TETA', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          source: 'toyota',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          tetaNumber: 'WT-001',
          departmentName: 'METAL',
          employmentStartDate: date('2026-06-03'),
          employmentEndDate: null,
        },
      ],
      sozRows: [],
      existingEmployees: [employee('existing-id', 'WT-001')],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview[0].status).toBe('existing');
    expect(preview[0].createInput).toBeNull();
    expect(preview[0].warnings).toContain('existing-employee');
  });

  it('blocks duplicated TETA numbers inside the import batch', () => {
    const common = {
      source: 'toyota' as const,
      departmentName: 'METAL',
      employmentStartDate: date('2026-06-03'),
      employmentEndDate: null,
    };
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          ...common,
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          tetaNumber: 'WT-001',
        },
        {
          ...common,
          rowNumber: 3,
          firstName: 'Jan',
          lastName: 'Nowak',
          tetaNumber: 'WT-001',
        },
      ],
      sozRows: [],
      existingEmployees: [],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview.map((row) => row.status)).toEqual([
      'duplicate',
      'duplicate',
    ]);
  });

  it('blocks rows without employment start or TETA', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          source: 'toyota',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          tetaNumber: '',
          departmentName: 'METAL',
          employmentStartDate: null,
          employmentEndDate: null,
        },
      ],
      sozRows: [],
      existingEmployees: [],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toEqual(
      expect.arrayContaining(['missing-teta', 'missing-employment-start']),
    );
  });

  it('keeps NA0 unmapped and warns instead of mapping it to another department', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          source: 'toyota',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Kowalska',
          tetaNumber: 'WT-001',
          departmentName: 'NA0',
          employmentStartDate: date('2026-06-03'),
          employmentEndDate: null,
        },
      ],
      sozRows: [],
      existingEmployees: [],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview[0].departmentId).toBeNull();
    expect(preview[0].warnings).toContain('department-na0');
  });

  it('warns about company housing when no safe accommodation variant is configured', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [
        {
          source: 'toyota',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Boiko',
          tetaNumber: 'WT-002',
          departmentName: 'METAL',
          employmentStartDate: date('2026-06-03'),
          employmentEndDate: null,
        },
      ],
      sozRows: [
        {
          source: 'soz-ua',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Boiko',
          identityNumber: 'GN142425',
          companyHousingMediaAmount: 500,
          companyHousingAccommodationAmount: 150,
          ownHousingAllowanceAmount: 0,
        },
      ],
      existingEmployees: [],
      departments: [department('metal', 'Metal')],
      accommodationVariants: [],
    });

    expect(preview[0].status).toBe('new');
    expect(preview[0].warnings).toContain('company-housing-variant-required');
    expect(preview[0].createInput).toMatchObject({
      tetaNumber: 'WT-002',
      passportNumber: 'GN142425',
    });
  });

  it('shows unmatched SOZ rows as blocked preview rows', () => {
    const preview = buildEmployeeImportPreview({
      toyotaRows: [],
      sozRows: [
        {
          source: 'soz-ua',
          rowNumber: 2,
          firstName: 'Anna',
          lastName: 'Boiko',
          identityNumber: 'GN142425',
          companyHousingMediaAmount: 500,
          companyHousingAccommodationAmount: 150,
          ownHousingAllowanceAmount: 0,
        },
      ],
      existingEmployees: [],
      departments: [],
      accommodationVariants: [],
    });

    expect(preview[0]).toMatchObject({
      status: 'blocked',
      source: 'soz-ua',
    });
    expect(preview[0].warnings).toContain('soz-unmatched');
  });
});

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function employee(id: string, tetaNumber: string): Employee {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id,
    tetaNumber,
    firstName: 'Anna',
    lastName: 'Kowalska',
    pesel: null,
    passportNumber: null,
    foreignDocumentNumber: null,
    isActive: true,
    departmentId: null,
    shiftAssignment: null,
    employmentStartDate: now,
    employmentEndDate: null,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}

function department(id: string, name: string): Department {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id,
    name,
    shiftMode: 'UNKNOWN',
    active: true,
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}
