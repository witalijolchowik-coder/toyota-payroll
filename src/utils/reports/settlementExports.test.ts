import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import type { EmployeeMonthlyCalculationDraft } from '../payroll';
import {
  SOZ_CSV_HEADERS,
  TOYOTA_EXPORT_HEADERS,
  classifySozWorker,
  prepareSettlementExportPackage,
  renderSozOvertimeNote,
  type SettlementExportRecord,
} from './settlementExports';

describe('settlement export formats', () => {
  it('distinguishes unfinished previews from final close artifacts', () => {
    const input = {
      monthId: '2026-06' as const,
      monthNominalHours: 168,
      records: [exportRecord({ id: '1', tetaNumber: 'T1' })],
    };
    const preview = prepareSettlementExportPackage({
      ...input,
      mode: 'preview',
    });
    const final = prepareSettlementExportPackage({ ...input, mode: 'final' });

    expect(preview.soz.plFileName).toContain('ROZLICZENIE_NIEZAMKNIETE');
    expect(final.soz.plFileName).toBe('SOZ_TBPL_PL_2026-06.csv');
    expect(final.toyota.fileName).not.toContain('NIEZAKOŃCZONE');
  });

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
          citizenship: 'UA',
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
      severity: 'BLOCKER',
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

  it('keeps only payable overtime addons in SOZ and explains covered niedoczas', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          citizenship: 'UA',
          identity: { pesel: '12345678901', passport: 'FU419350' },
          draft: draft({
            overtime100Hours: 5,
            paidOvertime100Hours: 2,
            shortageCovered100Hours: 3,
            overtime50Hours: 4,
            paidOvertime50Hours: 1,
            shortageCovered50Hours: 3,
          }),
        }),
      ],
    });

    const godziny100Index = SOZ_CSV_HEADERS.indexOf('Godziny 100');
    expect(result.soz.foreignRows[0]?.cells[godziny100Index]).toBe('2');
    expect(result.soz.note).toContain('TETA T1');
    expect(result.soz.note).toContain('100% 3 h');
    expect(result.soz.note).toContain('100% 2 h');
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
            shortageCovered50Hours: 4,
            overtime100Hours: 3,
            paidOvertime100Hours: 1,
            shortageCovered100Hours: 2,
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

  it('creates a citizenship-specific compensation workbook only when needed', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          draft: draft({
            overtime50Hours: 4,
            paidOvertime50Hours: 0,
            shortageCovered50Hours: 4,
            overtime100Hours: 5,
            paidOvertime100Hours: 3,
            shortageCovered100Hours: 2,
            wznCompensatedHours: 2,
          }),
        }),
      ],
    });

    expect(result.soz.polishCompensationWorkbook).not.toBeNull();
    expect(result.soz.foreignCompensationWorkbook).toBeNull();
    const workbook = XLSX.read(result.soz.polishCompensationWorkbook!, {
      type: 'array',
    });
    const rows = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[workbook.SheetNames[0]!]!,
      { header: 1 },
    );
    expect(rows[0]).toEqual(
      expect.arrayContaining([
        'TETA',
        'Nominał pracownika',
        'Odbiór wolnego wymagany',
        'Odbiór wolnego rozliczony',
        'Wyjaśnienie',
      ]),
    );
  });

  it('renders an empty note when there are no odróbki za niedoczas', () => {
    expect(renderSozOvertimeNote([])).toBe(
      'Brak odróbek za niedoczas, odbiorów wolnego i uwag do NI.\r\n',
    );
  });

  it('exports canonical absence categories and ordinary NI notes', () => {
    const employeeDraft = draft();
    employeeDraft.absences.groups = [
      { code: 'OP', dayCount: 1, nominalHours: 8 },
      { code: 'UO', dayCount: 1, nominalHours: 8 },
      { code: 'LO', dayCount: 1, nominalHours: 8 },
      { code: 'O5', dayCount: 1, nominalHours: 8 },
      { code: 'SR', dayCount: 1, nominalHours: 8 },
      { code: 'GN', dayCount: 1, nominalHours: 2 },
    ];
    employeeDraft.absences.gnHours = 2;
    employeeDraft.absences.periods = [
      {
        id: 'ni-note',
        code: 'NI',
        startDate: '2026-06-12',
        endDate: '2026-06-12',
        workingDayCount: 1,
        workingHours: 8,
        workingDates: [{ date: '2026-06-12', hours: 8 }],
        note: 'Wizyta urzędowa',
        overtimeTimeOff: false,
      },
    ];
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [exportRecord({ id: '1', draft: employeeDraft })],
    });
    const row = result.soz.polishRows[0]?.cells;

    expect(row?.[17]).toBe('8');
    expect(row?.[18]).toBe('8');
    expect(row?.[20]).toBe('8');
    expect(row?.[21]).toBe('8');
    expect(row?.[22]).toBe('8');
    expect(row?.[23]).toBe('2');
    expect(result.soz.note).toContain('NI 2026-06-12: Wizyta urzędowa');
    expect(result.soz.polishCompensationWorkbook).toBeNull();
    expect(result.absences.polishRows).toEqual([
      expect.objectContaining({ code: 'NI', workingHours: 8 }),
    ]);
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

  it('uses the binding 43-column Toyota confirmation schema and a real xlsx workbook', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [exportRecord({ id: '1' })],
    });
    expect(TOYOTA_EXPORT_HEADERS).toHaveLength(43);
    expect(TOYOTA_EXPORT_HEADERS.slice(0, 7)).toEqual([
      'Nazwisko',
      'Imię',
      'Numer personalny',
      'Agencja',
      'Jednostka organizacyjna/Dział',
      'Stanowisko',
      'Stawka',
    ]);
    expect(result.toyota.workbook.slice(0, 2)).toEqual(
      new Uint8Array([0x50, 0x4b]),
    );
    const workbook = XLSX.read(result.toyota.workbook, { type: 'array' });
    expect(workbook.SheetNames).toEqual(['Godziny']);
    expect(
      XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Godziny!, {
        header: 1,
      })[0],
    ).toEqual([...TOYOTA_EXPORT_HEADERS]);
  });

  it('exports canonical night hours to the binding Toyota and SOZ positions', () => {
    const record = exportRecord({
      id: '1',
      draft: draft({ nightHours: 24 }),
    });
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [record],
    });

    expect(result.toyota.rows[0]?.cells[15]).toBe('24');
    expect(result.soz.polishRows[0]?.cells[7]).toBe('24');
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

  it('maps housing, deposit, UDT and holiday components to the historical 138-column SOZ contract', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          draft: draft({
            components: {
              housingDepositWithholding: 99,
              housingDepositReturn: 99,
              ownHousingAllowanceBrutto: 300,
              udtAllowanceBrutto: 300,
              holidayWorkBonusBrutto: 300,
              holidayWorkBonusSuggestedBrutto: 300,
              holidayWorkBonusDecision: 'CONFIRMED',
            },
          }),
        }),
      ],
    });
    const cells = result.soz.polishRows[0]?.cells;

    expect(cells).toHaveLength(138);
    expect(cells?.slice(92, 101)).toEqual([
      '99',
      'Netto',
      'Kaucja',
      '99',
      'Netto',
      'Kaucja - Zwrot',
      '300',
      'Brutto',
      'Dodatek za mieszkanie',
    ]);
    expect(cells?.slice(126, 129)).toEqual(['300', 'Brutto', 'Premia za UDT']);
    expect(cells?.slice(134, 137)).toEqual([
      '300',
      'Brutto',
      'Premia świąteczna ( za wykonania zleceń / pracy w świąteczne dni)',
    ]);
  });

  it('blocks a lossy SOZ export when more than two additional premium components are present', () => {
    const result = prepareSettlementExportPackage({
      monthId: '2026-06',
      monthNominalHours: 168,
      records: [
        exportRecord({
          id: '1',
          draft: draft({
            components: {
              udtAllowanceBrutto: 300,
              holidayWorkBonusBrutto: 300,
              manualIncreases: 100,
            },
          }),
        }),
      ],
    });

    expect(result.warnings).toContainEqual({
      code: 'unsupported-columns',
      severity: 'BLOCKER',
      employeeId: '1',
      tetaNumber: 'T1',
    });
  });
});

function exportRecord({
  id,
  tetaNumber = 'T1',
  firstName = 'Jan',
  lastName = 'Kowalski',
  identity = { pesel: '87010409887' },
  departmentName = 'PS',
  citizenship = 'PL',
  draft: draftOverride,
}: {
  id: string;
  tetaNumber?: string;
  firstName?: string;
  lastName?: string;
  identity?: SettlementExportRecord['identity'];
  departmentName?: string | null;
  citizenship?: 'PL' | 'UA' | 'OTHER' | null;
  draft?: EmployeeMonthlyCalculationDraft;
}): SettlementExportRecord {
  return {
    employee: {
      id,
      tetaNumber,
      firstName,
      lastName,
      citizenship,
      firstToyotaEmploymentDate: new Date('2026-04-01T00:00:00.000Z'),
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
    shortageCovered50Hours?: number;
    shortageCovered100Hours?: number;
    nightHours?: number;
    wznCompensatedHours?: number;
    components?: Partial<EmployeeMonthlyCalculationDraft['components']>;
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
      gnHours: 0,
    },
    workDays: {
      eligibleWorkingDays: 21,
      physicallyWorkedDays: 21,
    },
    workTime: {
      normalWorkHours: 168,
      nightHours: overrides.nightHours ?? 0,
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
      overtimeAllocations: [],
      shortageCovered50Hours: overrides.shortageCovered50Hours ?? 0,
      shortageCovered100Hours: overrides.shortageCovered100Hours ?? 0,
      timeOffHours: overrides.wznCompensatedHours ?? 0,
      timeOffAllocatedHours: overrides.wznCompensatedHours ?? 0,
      timeOffUnresolvedHours: 0,
      timeOff50Hours: 0,
      timeOff100Hours: overrides.wznCompensatedHours ?? 0,
      holidayWorkBonusEligible: false,
      wznCompensatedHours: overrides.wznCompensatedHours ?? 0,
      wznUnresolvedHours: 0,
      unresolvedClassificationDays: [],
      niedoczasHours: 0,
    },
    bonuses: {
      frequency: {
        amount: 400,
        configuredSettingId: 'frequency',
        configuredAmount: 400,
        l4RecordCount: 0,
        l4MissedWorkingDayCount: 0,
        affectingAbsenceDayCount: 0,
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
      holidayWorkBonusSuggestedBrutto: 0,
      holidayWorkBonusDecision: null,
      transportAllowanceNetto: 275,
      udtAllowanceBrutto: 0,
      laundryAllowanceBrutto: 40,
      ownHousingAllowanceBrutto: 0,
      manualIncreases: 0,
      manualDecreases: 0,
      companyAccommodationDeduction: 0,
      companyAccommodationMediaDeduction: 0,
      companyAccommodationRentDeduction: 0,
      housingDepositHeld: 0,
      housingDepositEpisodeId: null,
      housingDepositWithholding: 0,
      housingDepositAutomaticReturn: 0,
      housingDepositReturn: 0,
      housingDepositReturnDue: false,
      housingDepositPriorWithholdingProven: false,
      ...overrides.components,
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
      returns: 0,
      preliminaryGrossAdditions: 440,
      preliminaryGrossDeductions: 0,
    },
  };
}
