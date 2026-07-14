import { describe, expect, it } from 'vitest';

import type { EmployeeMonthlyCalculationDraft } from '../payroll';
import {
  SOZ_CSV_HEADERS,
  classifySozWorker,
  prepareSettlementExportPackage,
  renderSozOvertimeNote,
  type SettlementExportRecord,
} from './settlementExports';

describe('settlement export formats', () => {
  it('keeps Toyota export as one combined worker list', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({ id: '1', tetaNumber: 'T1', lastName: 'Kowalski' }),
        exportRecord({ id: '2', tetaNumber: 'T2', lastName: 'Shevchenko' }),
      ],
    });

    expect(result.toyota.rows).toHaveLength(2);
    expect(result.toyota.rows.map((row) => row.tetaNumber)).toEqual([
      'T1',
      'T2',
    ]);
  });

  it('splits SOZ workers by PESEL/passport identity rule', () => {
    expect(classifySozWorker({ pesel: '87010409887' })).toBe('polish');
    expect(
      classifySozWorker({ pesel: '12345678901', passport: 'FU419350' }),
    ).toBe('foreign');
    expect(classifySozWorker(null)).toBe('missing-identity');

    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          tetaNumber: 'PL',
          identity: { pesel: '87010409887' },
        }),
        exportRecord({
          id: '2',
          tetaNumber: 'UA',
          identity: { pesel: '12345678901', passport: 'FU419350' },
        }),
      ],
    });

    expect(result.soz.polishRows.map((row) => row.tetaNumber)).toEqual(['PL']);
    expect(result.soz.foreignRows.map((row) => row.tetaNumber)).toEqual(['UA']);
  });

  it('reports insufficient identity data instead of faking SOZ split', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [exportRecord({ id: '1', tetaNumber: 'T1', identity: null })],
    });

    expect(result.soz.polishRows).toHaveLength(0);
    expect(result.soz.foreignRows).toHaveLength(0);
    expect(result.warnings).toContainEqual({
      code: 'missing-identity',
      employeeId: '1',
      tetaNumber: 'T1',
    });
  });

  it('does not infer SOZ nationality from name or department', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          tetaNumber: 'T1',
          lastName: 'KOWALSKI',
          identity: null,
          departmentName: 'PU',
        }),
        exportRecord({
          id: '2',
          tetaNumber: 'T2',
          lastName: 'SHEVCHENKO',
          identity: null,
          departmentName: 'Headliner',
        }),
      ],
    });

    expect(result.soz.polishRows).toHaveLength(0);
    expect(result.soz.foreignRows).toHaveLength(0);
    expect(
      result.warnings.filter((warning) => warning.code === 'missing-identity'),
    ).toHaveLength(2);
  });

  it('keeps SOZ overtime 100% combined while the note explains covered niedoczas', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          identity: { pesel: '12345678901', passport: 'FU419350' },
          draft: draft({
            overtime100Hours: 5,
            paidOvertime100Hours: 2,
            overtime50Hours: 4,
            paidOvertime50Hours: 1,
          }),
        }),
      ],
    });

    const godziny100Index = SOZ_CSV_HEADERS.indexOf('Godziny 100');
    expect(result.soz.foreignRows[0]?.cells[godziny100Index]).toBe('5');
    expect(result.soz.note).toContain('TETA T1');
    expect(result.soz.note).toContain('do wypłaty 2 h');
    expect(result.soz.note).toContain('na odróbkę 3 h');
  });

  it('separates paid overtime from overtime covering niedoczas for Toyota mapping', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          draft: draft({
            overtime50Hours: 6,
            paidOvertime50Hours: 2,
            overtime100Hours: 3,
            paidOvertime100Hours: 1,
          }),
        }),
      ],
    });

    expect(result.toyota.rows[0]).toMatchObject({
      paidOvertime50Hours: 2,
      paidOvertime100Hours: 1,
      overtimeCoveringNiedoczas50Hours: 4,
      overtimeCoveringNiedoczas100Hours: 2,
    });
  });

  it('renders an empty note when there are no odróbki za niedoczas', () => {
    expect(renderSozOvertimeNote([])).toBe('Brak odróbek za niedoczas.\r\n');
  });

  it('preserves SOZ template-derived columns and excludes tax/net payroll concepts', () => {
    expect(SOZ_CSV_HEADERS).toHaveLength(138);
    expect(SOZ_CSV_HEADERS.slice(0, 12)).toEqual([
      'Nazwisko',
      'Imię',
      'Paszport / PESEL',
      'Rok',
      'Miesiąc',
      'Zwolnienie L4 przez cały miesiąc',
      'Godziny zwykłe (suma dzienne plus nocne) ',
      'Godziny nocne (do wyliczenia dodatku za prace w porze nocnej)',
      'Godziny 50',
      'Godziny 100',
      'Harmonogram - nominał pracownika na dany miesiąc',
      'Czas nominalny',
    ]);
    expect(SOZ_CSV_HEADERS.join('|')).not.toMatch(/ZUS|PIT|net salary/i);
  });

  it('renders SOZ CSV with BOM, semicolon delimiter and positional repeated-column mapping', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          identity: { pesel: '87010409887' },
        }),
      ],
    });

    expect(result.soz.polishCsv.startsWith('\uFEFFNazwisko;Imię;')).toBe(true);
    const firstDataRow = result.soz.polishCsv.split('\r\n')[1]?.split(';');

    expect(firstDataRow?.[106]).toBe('275');
    expect(firstDataRow?.[107]).toBe('Netto');
    expect(firstDataRow?.[108]).toBe('Dodatek za dojazd do pracy');
    expect(firstDataRow?.[122]).toBe('400');
    expect(firstDataRow?.[123]).toBe('Brutto');
    expect(firstDataRow?.[124]).toBe('Premia frekwencyjna');
    expect(firstDataRow?.[130]).toBe('40');
    expect(firstDataRow?.[131]).toBe('Brutto');
    expect(firstDataRow?.[132]).toBe('Ekwiwalent za prania');
  });
});

function exportRecord({
  id,
  tetaNumber = 'T1',
  firstName = 'Jan',
  lastName = 'Kowalski',
  identity = { pesel: '87010409887' },
  departmentName = 'PS',
  draft: draftOverride,
}: {
  id: string;
  tetaNumber?: string;
  firstName?: string;
  lastName?: string;
  identity?: SettlementExportRecord['identity'];
  departmentName?: string | null;
  draft?: EmployeeMonthlyCalculationDraft;
}): SettlementExportRecord {
  return {
    employee: {
      id,
      tetaNumber,
      firstName,
      lastName,
      employmentStartDate: new Date('2026-01-01T00:00:00.000Z'),
      employmentEndDate: null,
    },
    identity,
    departmentName,
    draft: draftOverride ?? draft({ tetaNumber }),
    reviewStatus: 'CHECKED',
    unresolvedIssueCount: 0,
    dailyCells: [
      { dayOfMonth: 1, hours: 8 },
      { dayOfMonth: 2, hours: 8 },
    ],
  };
}

function draft(
  overrides: {
    tetaNumber?: string;
    overtime50Hours?: number;
    overtime100Hours?: number;
    paidOvertime50Hours?: number;
    paidOvertime100Hours?: number;
  } = {},
): EmployeeMonthlyCalculationDraft {
  return {
    employeeId: '1',
    tetaNumber: overrides.tetaNumber ?? 'T1',
    monthId: '2026-06',
    employment: {
      employmentStart: new Date('2026-01-01T00:00:00.000Z'),
      employmentEnd: null,
      participatesInMonth: true,
      fullCalendarMonth: true,
      individualNominalHours: 168,
    },
    attendance: {
      workedHoursTotal: 168,
      explicitHours: 0,
      manualHours: 0,
      importedHours: 0,
      importedOverrideHours: 0,
      virtualHours: 168,
      conflictDays: [],
      outsideEmploymentValueDays: [],
    },
    absences: {
      groups: [],
      periods: [],
      l4Hours: 0,
      vacationHours: 0,
      otherAbsenceHours: 0,
      nnHours: 0,
      approvedOrJustifiedHours: 0,
    },
    workDays: {
      eligibleWorkingDays: 21,
      physicallyWorkedDays: 21,
    },
    workTime: {
      normalWorkHours: 168,
      privateTimeHours: 0,
      privateTimeCoveredHours: 0,
      uncoveredPrivateTimeHours: 0,
      coverableNiHours: 0,
      coverableNiCoveredHours: 0,
      uncoveredCoverableNiHours: 0,
      overtime50Hours: overrides.overtime50Hours ?? 0,
      overtime100Hours: overrides.overtime100Hours ?? 0,
      paidOvertime50Hours: overrides.paidOvertime50Hours ?? 0,
      paidOvertime100Hours: overrides.paidOvertime100Hours ?? 0,
      holidayWorkBonusEligible: false,
      unresolvedClassificationDays: [],
      niedoczasHours: 0,
    },
    bonuses: {
      frequency: {
        amount: 400,
        configuredSettingId: 'frequency',
        configuredAmount: 400,
        l4RecordCount: 0,
        hasNnAbsence: false,
        reason: 'ELIGIBLE',
      },
    },
    adjustments: {
      increases: 0,
      decreases: 0,
      entries: [],
    },
    components: {
      baseSalaryBrutto: 5_160,
      frequencyBonusBrutto: 400,
      holidayWorkBonusBrutto: 0,
      transportAllowanceNetto: 275,
      udtAllowanceBrutto: 0,
      laundryAllowanceBrutto: 40,
      ownHousingAllowanceBrutto: 0,
      manualIncreases: 0,
      manualDecreases: 0,
      companyAccommodationDeduction: 0,
      companyAccommodationMediaDeduction: 0,
      companyAccommodationRentDeduction: 0,
    },
    warnings: [],
    totals: {
      workedHours: 168,
      nominalHours: 168,
      frequencyBonusAmount: 400,
      manualIncreases: 0,
      manualDecreases: 0,
      bruttoAdditions: 440,
      nettoAllowances: 275,
      deductions: 0,
      preliminaryGrossAdditions: 440,
      preliminaryGrossDeductions: 0,
    },
  };
}
