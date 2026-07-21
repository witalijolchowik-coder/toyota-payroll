import { describe, expect, it } from 'vitest';

import type {
  Department,
  Employee,
  EmployeeContract,
} from '../../types/firestore';
import {
  buildBulkEmployeeUpdatePreview,
  buildEmployeeUpdateTemplateCsv,
  buildNewEmployeeTemplateCsv,
  buildNewEmployeeTemplatePreview,
  EMPLOYEE_TEMPLATE_CLEAR_MARKER,
  employeeTemplateHeaders,
  employeesExceedingContractTemplateLimit,
  planEmployeeContractImport,
} from './employeeTemplateImport';

describe('employee template import', () => {
  it('generates a new employee template with required columns', () => {
    const csv = buildNewEmployeeTemplateCsv();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Numer TETA;Imię;Nazwisko');
    expect(employeeTemplateHeaders).toContain(
      'Data pierwszego zatrudnienia w Toyota',
    );
    expect(employeeTemplateHeaders).not.toContain('Data rozpoczęcia pracy');
    expect(employeeTemplateHeaders).not.toContain('Data zakończenia pracy');
    for (let slot = 1; slot <= 5; slot += 1) {
      expect(employeeTemplateHeaders).toContain(`Umowa ${slot} od`);
      expect(employeeTemplateHeaders).toContain(`Umowa ${slot} do`);
    }
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
          '2026-12-31',
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
      ['WT-001', '', 'Kowalska', '', '', '', '2026-06-03', '2026-12-31'],
      'missing-first-name',
    ],
    [
      'missing last name',
      ['WT-001', 'Anna', '', '', '', '', '2026-06-03', '2026-12-31'],
      'missing-last-name',
    ],
    ['missing contract', ['WT-001', 'Anna', 'Kowalska'], 'missing-contract'],
  ])('blocks new employee row with %s', (_, row, warning) => {
    const preview = buildNewEmployeeTemplatePreview(csv([row]), [], []);

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toContain(warning);
    expect(preview[0].createInput).toBeNull();
  });

  it('allows preparation of a new employee without TETA and reports a warning', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([['', 'Anna', 'Kowalska', '', '', '', '2026-06-03', '2026-12-31']]),
      [],
      [],
    );

    expect(preview[0].status).toBe('new');
    expect(preview[0].warnings).toContain('missing-teta');
    expect(preview[0].createInput?.tetaNumber).toBe('');
  });

  it('does not create an existing employee with duplicate TETA', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        ['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03', '2026-12-31'],
      ]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('existing');
    expect(preview[0].createInput).toBeNull();
  });

  it('detects duplicate TETA inside a new employee import file', () => {
    const preview = buildNewEmployeeTemplatePreview(
      csv([
        ['WT-001', 'Anna', 'Kowalska', '', '', '', '2026-06-03', '2026-12-31'],
        ['WT-001', 'Jan', 'Nowak', '', '', '', '2026-06-03', '2026-12-31'],
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
      csv([
        [
          'WT-001',
          'Anna',
          'Boiko',
          '',
          'GN142425',
          '',
          '2026-06-03',
          '2026-12-31',
        ],
      ]),
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
        [
          'WT-001',
          'Anna',
          'Kowalska',
          '',
          '',
          '',
          '2026-06-03',
          '2026-12-31',
          'Unknown',
        ],
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
        [
          'WT-001',
          'Anna',
          'Kowalska',
          '',
          '',
          '',
          '2026-06-03',
          '2026-12-31',
          'NA0',
        ],
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
          '2026-12-31',
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

  it('keeps unresolved legacy-inactive employees in the operational template', () => {
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
    expect(csvText).toContain('WT-002');
    expect(csvText).toContain('WT-003');
  });

  it('generates a fresh update template with only reference columns populated', () => {
    const current = {
      ...employee('active', 'WT-001'),
      phoneNumber: '+48 500 600 700',
      pesel: '81010112345',
      passportNumber: 'FA123456',
      citizenship: 'PL',
      gender: 'K' as const,
      firstToyotaEmploymentDate: date('2025-01-02'),
      medicalExaminationDate: date('2026-01-02'),
      medicalValidUntil: date('2027-01-02'),
      medicalExaminationType: 'PRODUKCJA' as const,
      departmentId: 'metal',
      shiftAssignment: 'RED' as const,
    };

    const first = buildEmployeeUpdateTemplateCsv(
      [current],
      [department('metal', 'Metal')],
      date('2026-06-10'),
    );
    const second = buildEmployeeUpdateTemplateCsv(
      [current],
      [department('metal', 'Metal')],
      date('2026-06-10'),
    );
    const rows = first
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');

    expect(first).toBe(second);
    expect(rows[0].split(';')).toEqual(employeeTemplateHeaders);
    expect(rows[1].split(';').slice(0, 3)).toEqual([
      'WT-001',
      'Anna',
      'Kowalska',
    ]);
    const values = rows[1].split(';');
    expect(values[employeeTemplateHeaders.indexOf('Umowa 1 od')]).toBe(
      '2026-06-01',
    );
    expect(values[employeeTemplateHeaders.indexOf('Umowa 1 do')]).toBe(
      '2026-12-31',
    );
    expect(first).not.toContain('Inny dokument');
    expect(first).not.toContain('+48 500 600 700');
    expect(first).not.toContain('81010112345');
    expect(first).not.toContain('FA123456');
    expect(first).not.toContain('PRODUKCJA');
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

  it('blocks a name mismatch and never renames the employee', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      csv([['WT-001', 'Joanna', 'Kowalska', '81010112345']]),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toContain('name-mismatch');
    expect(preview[0].changes.map((change) => change.field)).toEqual(['pesel']);
    expect(preview[0].updateInput).toBeNull();
  });

  it('rejects ambiguous duplicate TETA matches', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        PESEL: '81010112345',
      }),
      [employee('employee-1', 'WT-001'), employee('employee-2', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toContain('ambiguous-teta');
  });

  it('normalizes phone, citizenship, gender and medical data', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      departmentId: 'metal',
    };
    const preview = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        'Numer telefonu': '  +48  500 000 000 ',
        Obywatelstwo: 'pl',
        Płeć: 'k',
        'Data pierwszego zatrudnienia w Toyota': '2025-01-02',
        'Data badania lekarskiego': '2026-01-03',
        'Badanie ważne do': '2027-01-03',
        'Typ badania lekarskiego': 'Pracownik produkcji',
      }),
      [existing],
      [department('metal', 'Metal')],
    );

    expect(preview[0].status).toBe('ready');
    expect(preview[0].updateInput).toMatchObject({
      phoneNumber: '+48 500 000 000',
      citizenship: 'PL',
      gender: 'K',
      medicalExaminationType: 'PRODUKCJA',
    });
  });

  it('rejects invalid citizenship and an invalid medical date pair', () => {
    const preview = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        Obywatelstwo: 'XX',
        'Data badania lekarskiego': '2026-07-20',
        'Badanie ważne do': '2026-07-19',
      }),
      [employee('employee-1', 'WT-001')],
      [],
    );

    expect(preview[0].status).toBe('blocked');
    expect(preview[0].warnings).toEqual(
      expect.arrayContaining([
        'invalid-citizenship',
        'invalid-medical-date-range',
      ]),
    );
  });

  it('warns when medical type does not match the resulting department', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      departmentId: 'warehouse',
    };
    const preview = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        'Typ badania lekarskiego': 'Pracownik produkcji',
      }),
      [existing],
      [department('warehouse', 'Magazyn')],
    );

    expect(preview[0].status).toBe('warning');
    expect(preview[0].warnings).toContain('medical-type-department-mismatch');
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

  it('prefills all historical contracts oldest first and leaves unused slots empty', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      contracts: [
        contract('newer', '2026-04-01', '2026-06-30'),
        contract('older', '2026-01-01', '2026-03-31'),
      ],
    };

    const row = buildEmployeeUpdateTemplateCsv(
      [existing],
      [],
      date('2026-06-10'),
    )
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n')[1]!
      .split(';');

    expect(row[employeeTemplateHeaders.indexOf('Umowa 1 od')]).toBe(
      '2026-01-01',
    );
    expect(row[employeeTemplateHeaders.indexOf('Umowa 2 od')]).toBe(
      '2026-04-01',
    );
    expect(row[employeeTemplateHeaders.indexOf('Umowa 3 od')]).toBe('');
  });

  it('reports more than five contracts without deleting the extra history', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      contracts: Array.from({ length: 6 }, (_, index) =>
        contract(
          `contract-${index + 1}`,
          `202${index}-01-01`,
          `202${index}-12-31`,
        ),
      ),
    };

    expect(employeesExceedingContractTemplateLimit([existing])).toEqual([
      existing,
    ]);
    const plan = planEmployeeContractImport(existing, []);
    expect(plan.warnings).toContain('more-than-five-contracts');
    expect(
      plan.changes.filter(({ kind }) => kind === 'untouched'),
    ).toHaveLength(6);
  });

  it('validates contract pairs, ranges, duplicates and overlaps', () => {
    const partial = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        'Umowa 1 od': '2026-07-01',
      }),
      [employee('employee-1', 'WT-001')],
      [],
    )[0]!;
    const invalid = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        'Umowa 1 od': '2026-07-31',
        'Umowa 1 do': '2026-07-01',
      }),
      [employee('employee-1', 'WT-001')],
      [],
    )[0]!;
    const duplicateAndOverlap = buildBulkEmployeeUpdatePreview(
      updateCsv({
        'Numer TETA': 'WT-001',
        Imię: 'Anna',
        Nazwisko: 'Kowalska',
        'Umowa 1 od': '2026-01-01',
        'Umowa 1 do': '2026-03-31',
        'Umowa 2 od': '2026-01-01',
        'Umowa 2 do': '2026-03-31',
        'Umowa 3 od': '2026-03-15',
        'Umowa 3 do': '2026-04-30',
      }),
      [employee('employee-1', 'WT-001')],
      [],
    )[0]!;

    expect(partial.warnings).toContain('partial-contract');
    expect(invalid.warnings).toContain('invalid-contract-range');
    expect(duplicateAndOverlap.warnings).toEqual(
      expect.arrayContaining(['duplicate-contract', 'overlapping-contract']),
    );
  });

  it('ignores obsolete employment columns and never maps them to contracts', () => {
    const legacyCsv = [
      'Numer TETA;Imię;Nazwisko;Data rozpoczęcia pracy;Data zakończenia pracy',
      'WT-001;Anna;Kowalska;2025-01-01;2025-01-31',
    ].join('\n');
    const existing = employee('employee-1', 'WT-001');
    const preview = buildBulkEmployeeUpdatePreview(
      legacyCsv,
      [existing],
      [],
    )[0]!;

    expect(preview.status).toBe('no-changes');
    expect(preview.warnings).toContain('legacy-employment-columns-ignored');
    expect(preview.importedContracts).toEqual([]);
    expect(preview.contractChanges).toEqual([
      expect.objectContaining({ kind: 'untouched' }),
    ]);
    expect(preview.updateInput).toBeNull();
  });

  it('matches exact contracts, proposes positional correction and preserves blank later slots', () => {
    const existing = {
      ...employee('employee-1', 'WT-001'),
      contracts: [
        contract('first', '2026-01-01', '2026-03-31'),
        contract('second', '2026-04-01', '2026-06-30'),
      ],
    };
    const exact = planEmployeeContractImport(existing, [
      { slot: 1, startDate: '2026-01-01', endDate: '2026-03-31' },
    ]);
    const correction = planEmployeeContractImport(existing, [
      { slot: 1, startDate: '2026-01-01', endDate: '2026-03-30' },
      { slot: 2, startDate: '2026-03-31', endDate: '2026-06-30' },
    ]);

    expect(exact.changes).toEqual([
      expect.objectContaining({ kind: 'unchanged' }),
      expect.objectContaining({ kind: 'untouched' }),
    ]);
    expect(
      correction.changes.filter(({ kind }) => kind === 'update'),
    ).toHaveLength(2);
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
    'Umowa 1 od',
    'Umowa 1 do',
    'Dział',
    'Zmiana',
  ];
  return [header, ...rows].map((row) => row.join(';')).join('\n');
}

function updateCsv(
  values: Partial<Record<(typeof employeeTemplateHeaders)[number], string>>,
): string {
  return [
    employeeTemplateHeaders.join(';'),
    employeeTemplateHeaders.map((header) => values[header] ?? '').join(';'),
  ].join('\n');
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
    contracts: [contract(`contract-${id}`, '2026-06-01', '2026-12-31')],
    employmentEndEvents: [],
    createdAt: now,
    createdBy: 'test',
    updatedAt: now,
    updatedBy: 'test',
  };
}

function contract(
  id: string,
  startDate: string,
  endDate: string | null,
): EmployeeContract {
  const now = date('2026-06-01');
  return {
    id,
    employeeId: 'employee-1',
    tetaNumber: 'WT-001',
    sequenceId: 'sequence-1',
    startDate,
    endDate,
    status: 'ACTIVE',
    note: null,
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
