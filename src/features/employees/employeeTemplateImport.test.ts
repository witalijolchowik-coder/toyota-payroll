import { describe, expect, it } from 'vitest';

import type { Department, Employee } from '../../types/firestore';
import {
  buildBulkEmployeeUpdatePreview,
  buildEmployeeUpdateTemplateCsv,
  buildNewEmployeeTemplateCsv,
  buildNewEmployeeTemplatePreview,
  EMPLOYEE_TEMPLATE_CLEAR_MARKER,
} from './employeeTemplateImport';

describe('employee template import', () => {
  it('generates a new employee template with required columns', () => {
    const csv = buildNewEmployeeTemplateCsv();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Numer TETA;Imię;Nazwisko');
    expect(csv).toContain('Data rozpoczęcia pracy');
  });

  it('builds a valid new employee candidate from CSV', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        [
          'WT-001',
          'Anna',
          'Kowalska',
          '81010112345',
          '',
          '',
          '2026-06-03',
          '',
          'Metal',
          'RED',
        ],
      ]),
      [],
      [department('metal', 'Metal')],
    );

    expect(preview[0]).toMatchObject({
      status: 'new',
      tetaNumber: 'WT-001',
      pesel: '81010112345',
      departmentId: 'metal',
      shiftAssignment: 'RED',
    });
    expect(preview[0].createInput).toMatchObject({
      tetaNumber: 'WT-001',
      pesel: '81010112345',
      departmentId: 'metal',
      shiftAssignment: 'RED',
    });
  });

  it.each([
    [
      'missing first name',
      ['WT-001', '', 'Kowalska', '', '', '', '2026-06-03'],
      'missing-first-name',
    ],
    [
      'missing last name',
      ['WT-001', 'Anna', '', '', '', '', '2026-06-03'],
      'missing-last-name',
    ],
    [
      'missing employment start',
      ['WT-001', 'Anna', 'Kowalska'],
      'missing-employment-start',
    ],
  ])('blocks new employee row with %s', (_, row, warning) => {
    const preview = buildNewEmployeeTemplatePreview(csv([row]), [], []);

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toContain(warning);
    expect(preview[0].createInput).toBeNull();
  });

  it('allows preparation of a new employee without TETA and reports a warning', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([['', 'Anna', 'Kowalska', '', '', '', '2026-06-03']]),
      [],
      [],
    );

    expect(preview[0].status).toBe('new');
    expect(preview[0].warnings).toContain('missing-teta');
    expect(preview[0].createInput?.tetaNumber).toBe('');
  });

  it('does not create an existing employee with duplicate TETA', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03']]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('existing');
    expect(preview[0].createInput).toBeNull();
  });

  it('detects duplicate TETA inside a new employee import file', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        ['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03'],
        ['WT-001', 'Jan', 'Nowak', '', '', '', '2026-06-03'],
      ]),
      [],
      [],
    );

    expect(preview.map((row) => row.status)).toEqual([
      'duplicate',
      'duplicate',
    ]);
  });

  it('imports optional passport and keeps blank optional fields null', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([['WT-001', 'Anna', 'Boiko', '', 'GN142425', '', '2026-06-03']]),
      [],
      [],
    );

    expect(preview[0]).toMatchObject({
      passportNumber: 'GN142425',
      pesel: null,
      foreignDocumentNumber: null,
      status: 'new',
    });
  });

  it('warns and keeps unknown department unassigned for new employees', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        ['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03', '', 'Unknown'],
      ]),
      [],
      [department('metal', 'Metal')],
    );

    expect(preview[0].departmentId).toBeNull();
    expect(preview[0].warnings).toContain('department-unmapped');
    expect(preview[0].status).toBe('new');
  });

  it('warns and keeps NA0 unassigned', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        ['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03', '', 'NA0'],
      ]),
      [],
      [department('pu', 'PU'), department('headliner', 'Headliner')],
    );

    expect(preview[0].departmentId).toBeNull();
    expect(preview[0].warnings).toContain('department-na0');
  });

  it.each([
    ['MONTAZ', 'montaz'],
    ['PU', 'pu'],
    ['Headliner', 'headliner'],
    ['magazyn', 'magazyn'],
  ])('matches canonical department %s safely', (rawDepartment, expectedId) => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        [
          'WT-001',
          'Anna',
          'Kowalska',
          '',
          '',
          '',
          '2026-06-03',
          '',
          rawDepartment,
        ],
      ]),
      [],
      [
        department('montaz', 'Montaż'),
        department('pu', 'PU'),
        department('headliner', 'Headliner'),
        department('magazyn', 'Magazyn'),
      ],
    );

    expect(preview[0].departmentId).toBe(expectedId);
    expect(preview[0].warnings).not.toContain('department-unmapped');
  });

  it('generates an update template for active employees not ended before today', () => {
    const csvText = buildEmployeeUpdateTemplateCsv(
      [
        employee('active', 'WT-001'),
        { ...employee('inactive', 'WT-002'), isActive: false },
        {
          ...employee('ended', 'WT-003'),
          employmentEndDate: date('2026-05-31'),
        },
      ],
      [],
      date('2026-06-10'),
    );

    expect(csvText).toContain('WT-001');
    expect(csvText).not.toContain('WT-002');
    expect(csvText).not.toContain('WT-003');
  });

  it('uses TETA for bulk update matching and detects non-empty changes', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', 'Anna', 'Kowalska', '81010112345']]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('ready');
    expect(preview[0].changes).toEqual([
      expect.objectContaining({
        field: 'pesel',
        oldValue: '',
        newValue: '81010112345',
      }),
    ]);
    expect(preview[0].updateInput?.pesel).toBe('81010112345');
  });

  it('does not clear existing data from blank update cells', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      pesel: '81010112345',
    };
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', '', '', '']]),
      [existing],
      [],
    );

    expect(preview[0].status).toBe('no-changes');
    expect(preview[0].changes).toHaveLength(0);
  });

  it('supports explicit clear marker in update template', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      pesel: '81010112345',
    };
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', '', '', EMPLOYEE_TEMPLATE_CLEAR_MARKER]]),
      [existing],
      [],
    );

    expect(preview[0].status).toBe('ready');
    expect(preview[0].updateInput?.pesel).toBeNull();
    expect(preview[0].changes[0]).toMatchObject({
      field: 'pesel',
      newValue: EMPLOYEE_TEMPLATE_CLEAR_MARKER,
    });
  });

  it('blocks update rows with unknown TETA', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-404', 'Anna', 'Kowalska', '81010112345']]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toContain('unknown-teta');
  });

  it('warns about name mismatch but allows safe changes', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', 'Joanna', 'Kowalska', '81010112345']]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('warning');
    expect(preview[0].warnings).toContain('name-mismatch');
    expect(preview[0].changes.map((change) => change.field)).toEqual([
      'firstName',
      'pesel',
    ]);
  });

  it('updates department when safely matched and leaves shift optional', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', '', '', '', '', '', '', '', 'Metal', '']]),
      [employee('employee-1', 'WT-001')],
      [department('metal', 'Metal')],
    );

    expect(preview[0].status).toBe('ready');
    expect(preview[0].updateInput?.departmentId).toBe('metal');
    expect(preview[0].updateInput?.shiftAssignment).toBeNull();
  });

  it('warns on NA0 during bulk update without assigning PU or Headliner', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', '', '', '', '', '', '', '', 'NA0']]),
      [employee('employee-1', 'WT-001')],
      [department('pu', 'PU'), department('headliner', 'Headliner')],
    );

    expect(preview[0].status).toBe('no-changes');
    expect(preview[0].warnings).toContain('department-na0');
    expect(preview[0].updateInput).toBeNull();
  });
});

function csv(rows: readonly (readonly string[])[]): string {
  const header = [
    'Numer TETA',
    'Imię',
    'Nazwisko',
    'PESEL',
    'Paszport',
    'Inny dokument',
    'Data rozpoczęcia pracy',
    'Data zakończenia pracy',
    'Dział',
    'Zmiana',
  ];
  return [header, ...rows].map((row) => row.join(';')).join('\n');
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function employee(id: string, tetaNumber: string): Employee {
  const now = date('2026-06-01');
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
  const now = date('2026-06-01');
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
