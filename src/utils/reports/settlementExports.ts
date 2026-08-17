import type { Employee, MonthId } from '../../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from '../payroll';
import * as XLSX from 'xlsx';
import { absenceTypeName, type AbsenceExportRow } from './absenceWorkbook';

export type SozWorkerGroup = 'polish' | 'foreign' | 'missing-identity';
export type ExportReadinessWarningCode =
  | 'not-reviewed'
  | 'unresolved-issues'
  | 'missing-identity'
  | 'unsupported-columns'
  | 'empty-export';

export interface ExportEmployeeIdentity {
  pesel?: string | null;
  passport?: string | null;
  foreignDocument?: string | null;
}

export interface SettlementExportDailyCell {
  dayOfMonth: number;
  hours: number | null;
}

export interface SettlementExportRecord {
  employee: Pick<Employee, 'id' | 'tetaNumber' | 'firstName' | 'lastName'> &
    Partial<
      Pick<Employee, 'citizenship' | 'gender' | 'firstToyotaEmploymentDate'>
    >;
  departmentName?: string | null;
  identity?: ExportEmployeeIdentity | null;
  draft: EmployeeMonthlyCalculationDraft;
  reviewStatus?: 'DRAFT' | 'NEEDS_REVIEW' | 'NEEDS_CORRECTION' | 'CHECKED';
  unresolvedIssueCount?: number;
  dailyCells?: readonly SettlementExportDailyCell[];
}

export interface ExportReadinessWarning {
  code: ExportReadinessWarningCode;
  employeeId: string | null;
  tetaNumber: string | null;
}

export interface ToyotaExportRow {
  cells: string[];
  tetaNumber: string;
  paidOvertime50Hours: number;
  paidOvertime100Hours: number;
  overtimeCoveringNiedoczas50Hours: number;
  overtimeCoveringNiedoczas100Hours: number;
}

export interface SozExportRow {
  cells: string[];
  group: Exclude<SozWorkerGroup, 'missing-identity'>;
  tetaNumber: string;
}

export interface SozOvertimeNoteEntry {
  employeeLabel: string;
  tetaNumber: string;
  citizenshipGroup: 'Polska' | 'Cudzoziemcy';
  employeeNominalHours: number;
  shortageBeforeCompensationHours: number;
  sozOvertime50Hours: number;
  sozOvertime100Hours: number;
  timeOffHours: number;
  timeOffAllocatedHours: number;
  timeOffUnresolvedHours: number;
  paidOvertime50Hours: number;
  paidOvertime100Hours: number;
  coveringNiedoczas50Hours: number;
  coveringNiedoczas100Hours: number;
  timeOffEntries: {
    date: string;
    requiredHours: number;
    allocatedHours: number;
    unresolvedHours: number;
    note: string;
    sources: { date: string; rate: 50 | 100; hours: number }[];
  }[];
  ordinaryNiNotes: { startDate: string; endDate: string; note: string }[];
  note: string;
}

export interface SettlementExportPackage {
  monthId: MonthId;
  toyota: {
    fileName: string;
    headers: string[];
    rows: ToyotaExportRow[];
    workbook: Uint8Array;
  };
  soz: {
    plFileName: string;
    foreignFileName: string;
    noteFileName: string;
    headers: string[];
    polishRows: SozExportRow[];
    foreignRows: SozExportRow[];
    polishCsv: string;
    foreignCsv: string;
    note: string;
    noteEntries: SozOvertimeNoteEntry[];
    polishCompensationWorkbook: Uint8Array | null;
    foreignCompensationWorkbook: Uint8Array | null;
    polishCompensationFileName: string | null;
    foreignCompensationFileName: string | null;
  };
  absences: {
    plFileName: string;
    foreignFileName: string;
    polishRows: AbsenceExportRow[];
    foreignRows: AbsenceExportRow[];
  };
  warnings: ExportReadinessWarning[];
}

export const TOYOTA_EXPORT_HEADERS = [
  'Nazwisko',
  'Imię',
  'Numer personalny',
  'Agencja',
  'Jednostka organizacyjna/Dział',
  'Stanowisko',
  'Stawka',
  'Data zatrudnienia',
  'Data zwolnienia',
  'Plec',
  'Obywatelstwo',
  'Rok',
  'Miesiąc',
  'Zwolnienie L4 przez cały miesiąc',
  'Godziny zwykłe (suma dzienne plus nocne) ',
  'Godziny nocne (do wyliczenia dodatku za prace w porze nocnej)',
  'Godziny 50',
  'Godziny 100',
  'Harmonogram - nominał pracownika na dany miesiąc',
  'Czas nominalny',
  'Godziny nieobecność nieusprawiedliwiona NN',
  'Godziny nieobecność usprawiedliwiona płatna NU',
  'Godziny nieobecność usprawiedliwiona bezpłatna (niepłatna) NI',
  'Godziny urlop wypoczynkowy UW',
  'Godziny urlop bezpłatny UB',
  'Godziny opieka art. 188',
  'Godziny urlop okolicznościowy UO',
  'Godziny chorobowe L4',
  'Godziny zasiłku (opiekuńczy, macierzyński, tacierzyński)',
  'Godziny urlopu opieka z tytułu Art. 173 O5',
  'Godziny urlopu z tytułu siły wyższej Art. 148 SR',
  'Godziny niedoczas',
  'Godziny postojowe',
  'Godziny kwarantanny wypłacane jako godziny zwykłe',
  'Godziny 200 %',
  'Wolne za Nadgodziny',
  'Odróbka za Niedoczas',
  'Premia frekwencyjna / Kwota',
  'Premia frekwencyjna / Podatek',
  'Premia od Klienta / Kwota',
  'Premia od klienta / Podatek',
  'Ekwiwalent za prania  / Kwota',
  'Ekwiwalent za prania  / Podatek',
] as const;

export const SOZ_CSV_HEADERS = [
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
  'Godziny nieobecność nieusprawiedliwiona NN',
  'Godziny nieobecność usprawiedliwiona płatna NU',
  'Godziny nieobecność usprawiedliwiona bezpłatna (niepłatna) NI',
  'Godziny urlop wypoczynkowy UW',
  'Godziny urlop bezpłatny UB',
  'Godziny opieka art. 188',
  'Godziny urlop okolicznościowy UO',
  'Godziny chorobowe L4',
  'Godziny zasiłku (opiekuńczy, macierzyński, tacierzyński)',
  'Godziny urlopu opieka z tytułu Art. 173 O5',
  'Godziny urlopu z tytułu siły wyższej Art. 148 SR',
  'Godziny niedoczas',
  'Godziny postojowe',
  'Godziny kwarantanny wypłacane jako godziny zwykłe',
  'Godziny 200 %',
  'godziny zwykłe z dodatkiem 25%',
  'godziny zwykłe z dodatkiem 40%',
  'Ilość godzin do dodatku 1',
  'Ilość godzin do dodatku 2',
  'Ilość godzin do dodatku 3',
  'Kara dyscyplinarna / Kwota',
  'Kara dyscyplinarna / Podatek',
  'Kara dyscyplinarna / Opis',
  'Kara dyscyplinarna / Kwota',
  'Kara dyscyplinarna / Podatek',
  'Kara dyscyplinarna / Opis',
  'Kara od klienta-spółki / Kwota',
  'Kara od klienta-spółki  / Podatek',
  'Kara od klienta-spółki  / Opis',
  'Kara od klienta-spółki / Kwota',
  'Kara od klienta-spółki  / Podatek',
  'Kara od klienta-spółki  / Opis',
  'Kara od klienta-spółki / Kwota',
  'Kara od klienta-spółki  / Podatek',
  'Kara od klienta-spółki  / Opis',
  'Kara od klienta-spółki / Kwota',
  'Kara od klienta-spółki  / Podatek',
  'Kara od klienta-spółki  / Opis',
  'Media / Kwota',
  'Media / Podatek',
  'Media / Opis',
  'Mieszkanie / Kwota',
  'Mieszkanie / Podatek',
  'Mieszkanie / Opis',
  'Mieszkanie / Kwota',
  'Mieszkanie / Podatek',
  'Mieszkanie / Opis',
  'Wyżywienie / Kwota',
  'Wyżywienie / Podatek',
  'Wyżywienie / Opis',
  'Transport / Kwota',
  'Transport / Podatek',
  'Transport / Opis',
  'Transfer do Polski / Kwota',
  'Transfer do Polski / Podatek',
  'Transfer do Polski / Opis',
  'Szkoła / Kwota',
  'Szkoła / Podatek',
  'Szkoła / Opis',
  'Potrącenie inne / Kwota',
  'Potrącenie inne / Podatek',
  'Potrącenie inne / Opis',
  'Potrącenie inne / Kwota',
  'Potrącenie inne / Podatek',
  'Potrącenie inne / Opis',
  'Potrącenie inne / Kwota',
  'Potrącenie inne / Podatek',
  'Potrącenie inne / Opis',
  'Potrącenie inne / Kwota',
  'Potrącenie inne / Podatek',
  'Potrącenie inne / Opis',
  'Potrącenie inne / Kwota',
  'Potrącenie inne / Podatek',
  'Potrącenie inne / Opis',
  'Karta INNB – zaliczka / Kwota',
  'Karta INNB – zaliczka / Podatek',
  'Karta INNB – zaliczka / Opis',
  'Mieszkanie-potrącenia dodatkowe / Kwota',
  'Mieszkanie-potrącenia dodatkowe / Podatek',
  'Mieszkanie-potrącenia dodatkowe / Opis',
  'Mieszkanie - Kaucja / Kwota',
  'Mieszkanie - Kaucja / Podatek',
  'Mieszkanie - Kaucja / Opis',
  'Mieszkanie - Kaucja - Zwrot / Kwota',
  'Mieszkanie - Kaucja - Zwrot / Podatek',
  'Mieszkanie - Kaucja - Zwrot / Opis',
  'Dodatek za mieszkanie od spółki / Kwota',
  'Dodatek za mieszkanie od spółki / Podatek',
  'Dodatek za mieszkanie od spółki / Za co',
  'Dodatek za mieszkanie od spółki / Za co / Inne',
  'Dodatek za mieszkanie od klienta / Kwota',
  'Dodatek za mieszkanie od klienta / Podatek',
  'Dodatek za mieszkanie od klienta / Za co',
  'Dodatek za mieszkanie od klienta / Za co / Inne',
  'Premia spółki 1 / Kwota',
  'Premia spółki 1 / Podatek',
  'Premia spółki 1 / Za co',
  'Premia spółki 1 /  Za co / Inne',
  'Premia spółki 2 / Kwota',
  'Premia spółki 2 / Podatek',
  'Premia spółki 2 /  Za co',
  'Premia spółki 2 /  Za co / Inne',
  'Premia spółki 3 / Kwota',
  'Premia spółki 3 / Podatek',
  'Premia spółki 3 / Za co',
  'Premia spółki 3 /  Za co / Inne',
  'Premia spółki 4 / Kwota',
  'Premia spółki 4 / Podatek',
  'Premia spółki 4 /  Za co',
  'Premia spółki 4 /  Za co / Inne',
  'Premia od klienta 5 / Kwota',
  'Premia od klienta 5 / Podatek',
  'Premia od klienta 5 /  Za co',
  'Premia od klienta 5 /  Za co / Inne',
  'Premia od klienta 6 / Kwota',
  'Premia od klienta 6 / Podatek',
  'Premia od klienta 6 /  Za co',
  'Premia od klienta 6 /  Za co / Inne',
  'Premia od klienta 7 / Kwota',
  'Premia od klienta 7 / Podatek',
  'Premia od klienta 7 /  Za co',
  'Premia od klienta 7 /  Za co / Inne',
  'Premia od klienta 8 / Kwota',
  'Premia od klienta 8 / Podatek',
  'Premia od klienta 8 /  Za co',
  'Premia od klienta 8 /  Za co / Inne',
] as const;

const sozColumn = {
  lastName: 0,
  firstName: 1,
  identity: 2,
  year: 3,
  monthName: 4,
  fullMonthL4: 5,
  normalHours: 6,
  nightHours: 7,
  overtime50: 8,
  overtime100: 9,
  employeeNominal: 10,
  monthNominal: 11,
  nnHours: 12,
  nuHours: 13,
  niHours: 14,
  vacationHours: 15,
  unpaidVacationHours: 16,
  care188Hours: 17,
  occasionalLeaveHours: 18,
  l4Hours: 19,
  benefitLeaveHours: 20,
  careLeaveHours: 21,
  forceMajeureHours: 22,
  niedoczasHours: 23,
  companyHousingMediaAmount: 50,
  companyHousingMediaTax: 51,
  companyHousingMediaDescription: 52,
  companyHousingRentAmount: 53,
  companyHousingRentTax: 54,
  companyHousingRentDescription: 55,
  otherDeductionAmount: 71,
  otherDeductionTax: 72,
  otherDeductionDescription: 73,
  housingDepositWithholdingAmount: 92,
  housingDepositWithholdingTax: 93,
  housingDepositWithholdingDescription: 94,
  housingDepositReturnAmount: 95,
  housingDepositReturnTax: 96,
  housingDepositReturnDescription: 97,
  ownHousingAmount: 98,
  ownHousingTax: 99,
  ownHousingDescription: 100,
  transportAmount: 106,
  transportTax: 107,
  transportDescription: 108,
  frequencyBonusAmount: 122,
  frequencyBonusTax: 123,
  frequencyBonusDescription: 124,
  clientBonusAmount: 126,
  clientBonusTax: 127,
  clientBonusDescription: 128,
  laundryAmount: 130,
  laundryTax: 131,
  laundryDescription: 132,
  additionalClientBonusAmount: 134,
  additionalClientBonusTax: 135,
  additionalClientBonusDescription: 136,
} as const;

interface SozPremiumComponent {
  amount: number;
  tax: 'Brutto';
  description: string;
}

function additionalSozPremiums(
  draft: EmployeeMonthlyCalculationDraft,
): SozPremiumComponent[] {
  return [
    ...(draft.components.udtAllowanceBrutto > 0
      ? [
          {
            amount: draft.components.udtAllowanceBrutto,
            tax: 'Brutto' as const,
            description: 'Premia za UDT',
          },
        ]
      : []),
    ...(draft.components.holidayWorkBonusBrutto > 0
      ? [
          {
            amount: draft.components.holidayWorkBonusBrutto,
            tax: 'Brutto' as const,
            description:
              'Premia świąteczna ( za wykonania zleceń / pracy w świąteczne dni)',
          },
        ]
      : []),
    ...(draft.components.manualIncreases > 0
      ? [
          {
            amount: draft.components.manualIncreases,
            tax: 'Brutto' as const,
            description: 'Korekta ręczna',
          },
        ]
      : []),
  ];
}

const polishMonthNames = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const;

export function classifySozWorker(identity?: ExportEmployeeIdentity | null) {
  const hasPassport = Boolean(
    identity?.passport?.trim() || identity?.foreignDocument?.trim(),
  );
  const hasPesel = Boolean(identity?.pesel?.trim());

  if (hasPassport) {
    return 'foreign';
  }
  if (hasPesel) {
    return 'polish';
  }
  return 'missing-identity';
}

export function classifySozWorkerByCitizenship(
  citizenship: Employee['citizenship'],
): SozWorkerGroup {
  if (!citizenship) return 'missing-identity';
  return citizenship === 'PL' ? 'polish' : 'foreign';
}

export function prepareSettlementExportPackage({
  monthId,
  records,
  monthNominalHours,
}: {
  monthId: MonthId;
  records: readonly SettlementExportRecord[];
  monthNominalHours: number;
}): SettlementExportPackage {
  const sortedRecords = [...records].sort((first, second) =>
    employeeName(first).localeCompare(employeeName(second), 'pl-PL'),
  );
  const warnings = buildExportReadinessWarnings(sortedRecords);
  const toyotaRows = sortedRecords.map((record) =>
    mapToyotaExportRow(record, monthId, monthNominalHours),
  );
  const sozRows = sortedRecords.map((record) =>
    mapSozExportRow(record, monthId, monthNominalHours),
  );
  const polishRows = sozRows.filter(
    (row): row is SozExportRow => row?.group === 'polish',
  );
  const foreignRows = sozRows.filter(
    (row): row is SozExportRow => row?.group === 'foreign',
  );
  const noteEntries = sortedRecords
    .map(mapSozOvertimeNoteEntry)
    .filter((entry): entry is SozOvertimeNoteEntry => entry !== null);
  const note = renderSozOvertimeNote(noteEntries);
  const incomplete = warnings.length > 0;
  const prefix = incomplete ? `ROZLICZENIE_NIEZAMKNIETE_${monthId}` : null;

  const compensationEntries = noteEntries.filter(
    (entry) =>
      entry.coveringNiedoczas50Hours +
        entry.coveringNiedoczas100Hours +
        entry.timeOffHours >
      0,
  );
  const polishCompensation = compensationEntries.filter((entry) =>
    sortedRecords.some(
      (record) =>
        record.employee.tetaNumber === entry.tetaNumber &&
        record.employee.citizenship === 'PL',
    ),
  );
  const foreignCompensation = compensationEntries.filter((entry) =>
    sortedRecords.some(
      (record) =>
        record.employee.tetaNumber === entry.tetaNumber &&
        record.employee.citizenship !== 'PL' &&
        Boolean(record.employee.citizenship),
    ),
  );
  const absenceRows = sortedRecords.flatMap(mapAbsenceExportRows);
  const polishAbsenceRows = absenceRows.filter((row) => row.group === 'polish');
  const foreignAbsenceRows = absenceRows.filter(
    (row) => row.group === 'foreign',
  );
  const [, numericMonth] = monthId.split('-').map(Number);
  const absenceMonthName = polishMonthNames[(numericMonth ?? 1) - 1] ?? monthId;

  return {
    monthId,
    toyota: {
      fileName: prefix
        ? `Zestawienie_godzin_TBPL_NIEZAKOŃCZONE_${monthId}.xlsx`
        : `Zestawienie_godzin_TBPL_${monthId}.xlsx`,
      headers: [...TOYOTA_EXPORT_HEADERS],
      rows: toyotaRows,
      workbook: renderXlsxWorkbook({
        sheetName: 'Godziny',
        headers: TOYOTA_EXPORT_HEADERS,
        rows: toyotaRows.map((row) => row.cells),
        unfinished: incomplete,
      }),
    },
    soz: {
      plFileName: prefix
        ? `${prefix}_SOZ_PL.csv`
        : `SOZ_TBPL_PL_${monthId}.csv`,
      foreignFileName: prefix
        ? `${prefix}_SOZ_UA.csv`
        : `SOZ_TBPL_UA_${monthId}.csv`,
      noteFileName: prefix
        ? `${prefix}_NOTATKA.txt`
        : `SOZ_notatka_nadgodziny_niedoczas_${monthId}.txt`,
      headers: [...SOZ_CSV_HEADERS],
      polishRows,
      foreignRows,
      polishCsv: renderSozCsv(polishRows),
      foreignCsv: renderSozCsv(foreignRows),
      note,
      noteEntries,
      polishCompensationWorkbook: polishCompensation.length
        ? renderCompensationWorkbook(polishCompensation)
        : null,
      foreignCompensationWorkbook: foreignCompensation.length
        ? renderCompensationWorkbook(foreignCompensation)
        : null,
      polishCompensationFileName: polishCompensation.length
        ? `Odróbka_niedoczasu_PL_${monthId}.xlsx`
        : null,
      foreignCompensationFileName: foreignCompensation.length
        ? `Odróbka_niedoczasu_CUDZOZIEMCY_${monthId}.xlsx`
        : null,
    },
    absences: {
      plFileName: `Absencja_TBPL_${absenceMonthName}_${monthId.slice(0, 4)}_PL.xlsx`,
      foreignFileName: `Absencja_TBPL_${absenceMonthName}_${monthId.slice(0, 4)}_UA.xlsx`,
      polishRows: polishAbsenceRows,
      foreignRows: foreignAbsenceRows,
    },
    warnings,
  };
}

export function buildExportReadinessWarnings(
  records: readonly SettlementExportRecord[],
): ExportReadinessWarning[] {
  const warnings: ExportReadinessWarning[] = [];
  if (records.length === 0) {
    warnings.push({
      code: 'empty-export',
      employeeId: null,
      tetaNumber: null,
    });
  }

  records.forEach((record) => {
    if (record.reviewStatus !== 'CHECKED') {
      warnings.push({
        code: 'not-reviewed',
        employeeId: record.employee.id,
        tetaNumber: record.employee.tetaNumber,
      });
    }
    if ((record.unresolvedIssueCount ?? 0) > 0) {
      warnings.push({
        code: 'unresolved-issues',
        employeeId: record.employee.id,
        tetaNumber: record.employee.tetaNumber,
      });
    }
    if (additionalSozPremiums(record.draft).length > 2) {
      warnings.push({
        code: 'unsupported-columns',
        employeeId: record.employee.id,
        tetaNumber: record.employee.tetaNumber,
      });
    }
    if (
      classifySozWorkerByCitizenship(record.employee.citizenship) ===
        'missing-identity' ||
      classifySozWorker(record.identity) === 'missing-identity'
    ) {
      warnings.push({
        code: 'missing-identity',
        employeeId: record.employee.id,
        tetaNumber: record.employee.tetaNumber,
      });
    }
  });

  return warnings;
}

export function renderSozCsv(rows: readonly SozExportRow[]) {
  return `\uFEFF${[SOZ_CSV_HEADERS, ...rows.map((row) => row.cells)]
    .map((row) => row.map(escapeCsvCell).join(';'))
    .join('\r\n')}\r\n`;
}

export function renderSozOvertimeNote(
  entries: readonly SozOvertimeNoteEntry[],
) {
  if (entries.length === 0) {
    return 'Brak odróbek za niedoczas, odbiorów wolnego i uwag do NI.\r\n';
  }

  return [
    'Notatka do SOZ — nadgodziny, niedoczas i NI',
    '',
    'W kolumnach 50% i 100% pliku SOZ pozostają dodatki do wypłaty po rozliczeniu niedoczasu i odbioru wolnego. Podstawowe wynagrodzenie za przepracowane nadgodziny pozostaje częścią czasu przepracowanego.',
    '',
    ...entries.flatMap((entry) => {
      const lines = [`${entry.employeeLabel} — TETA ${entry.tetaNumber}:`];
      if (
        entry.coveringNiedoczas50Hours + entry.coveringNiedoczas100Hours >
        0
      ) {
        lines.push(
          `- Niedoczas przed rozliczeniem: ${formatNumber(entry.shortageBeforeCompensationHours)} h.`,
          `- Pokrycie niedoczasu: 50% ${formatNumber(entry.coveringNiedoczas50Hours)} h; 100% ${formatNumber(entry.coveringNiedoczas100Hours)} h.`,
          `- Dodatki pozostające w SOZ: 50% ${formatNumber(entry.paidOvertime50Hours)} h; 100% ${formatNumber(entry.paidOvertime100Hours)} h.`,
        );
      }
      entry.timeOffEntries.forEach((timeOff) => {
        const sources = timeOff.sources.length
          ? timeOff.sources
              .map(
                (source) =>
                  `${source.date} (${source.rate}%): ${formatNumber(source.hours)} h`,
              )
              .join(', ')
          : 'brak dostępnych wcześniejszych nadgodzin';
        lines.push(
          `- NI ${timeOff.date}: odbiór wolnego ${formatNumber(timeOff.allocatedHours)} z ${formatNumber(timeOff.requiredHours)} h; źródła: ${sources}.`,
        );
        if (timeOff.unresolvedHours > 0) {
          lines.push(
            `  Nierozliczone: ${formatNumber(timeOff.unresolvedHours)} h — wymaga decyzji przed zamknięciem miesiąca.`,
          );
        }
        if (timeOff.note) lines.push(`  Uwagi: ${timeOff.note}`);
      });
      entry.ordinaryNiNotes.forEach((absence) => {
        const dateRange =
          absence.startDate === absence.endDate
            ? absence.startDate
            : `${absence.startDate}–${absence.endDate}`;
        lines.push(`- NI ${dateRange}: ${absence.note}`);
      });
      lines.push('');
      return lines;
    }),
  ].join('\r\n');
}

function mapToyotaExportRow(
  record: SettlementExportRecord,
  monthId: MonthId,
  monthNominalHours: number,
): ToyotaExportRow {
  const draft = record.draft;
  const paidOvertime50 = draft.workTime.paidOvertime50Hours;
  const paidOvertime100 = draft.workTime.paidOvertime100Hours;
  const covering50 = draft.workTime.shortageCovered50Hours;
  const covering100 = draft.workTime.shortageCovered100Hours;
  const [year, month] = monthId.split('-').map(Number);
  const absence = (code: string) =>
    draft.absences.groups.find((group) => group.code === code)?.nominalHours ??
    0;
  const fullMonthL4 =
    draft.totals.nominalHours > 0 &&
    draft.absences.l4Hours >= draft.totals.nominalHours;
  return {
    tetaNumber: record.employee.tetaNumber,
    paidOvertime50Hours: paidOvertime50,
    paidOvertime100Hours: paidOvertime100,
    overtimeCoveringNiedoczas50Hours: covering50,
    overtimeCoveringNiedoczas100Hours: covering100,
    cells: [
      record.employee.lastName,
      record.employee.firstName,
      record.employee.tetaNumber,
      'PS',
      record.departmentName ?? '',
      '',
      formatNullableNumber(draft.components.baseSalaryBrutto),
      formatDate(draft.employment.employmentStart),
      formatDate(draft.employment.employmentEnd),
      record.employee.gender ?? '',
      record.employee.citizenship ?? '',
      String(year),
      String(month),
      fullMonthL4 ? 'Tak' : 'Nie',
      formatNumber(draft.workTime.normalWorkHours),
      formatNumber(draft.workTime.nightHours),
      formatNumber(paidOvertime50),
      formatNumber(paidOvertime100),
      formatNumber(draft.totals.nominalHours),
      formatNumber(monthNominalHours),
      formatNumber(absence('NN')),
      formatNumber(absence('NU')),
      formatNumber(absence('NI')),
      formatNumber(absence('UW')),
      formatNumber(absence('UB')),
      formatNumber(absence('OP')),
      formatNumber(absence('UO')),
      formatNumber(draft.absences.l4Hours),
      formatNumber(absence('LO')),
      formatNumber(absence('O5')),
      formatNumber(absence('SR')),
      formatNumber(draft.workTime.niedoczasHours),
      '0',
      '0',
      '0',
      formatNumber(draft.workTime.timeOffAllocatedHours),
      formatNumber(covering50 + covering100),
      formatNullableNumber(draft.components.frequencyBonusBrutto),
      draft.components.frequencyBonusBrutto === null ? '' : 'Brutto',
      formatNumber(draft.components.holidayWorkBonusBrutto),
      draft.components.holidayWorkBonusBrutto ? 'Brutto' : '',
      formatNumber(draft.components.laundryAllowanceBrutto),
      draft.components.laundryAllowanceBrutto ? 'Brutto' : '',
    ],
  };
}

function mapSozExportRow(
  record: SettlementExportRecord,
  monthId: MonthId,
  monthNominalHours: number,
): SozExportRow | null {
  const group = classifySozWorkerByCitizenship(record.employee.citizenship);
  if (group === 'missing-identity') {
    return null;
  }
  if (classifySozWorker(record.identity) === 'missing-identity') return null;

  const [year, month] = monthId.split('-').map(Number);
  const draft = record.draft;
  const cells = Array.from({ length: SOZ_CSV_HEADERS.length }, () => '');
  cells[sozColumn.lastName] = record.employee.lastName;
  cells[sozColumn.firstName] = record.employee.firstName;
  cells[sozColumn.identity] = identityValue(record.identity, group);
  cells[sozColumn.year] = String(year);
  cells[sozColumn.monthName] = polishMonthNames[(month ?? 1) - 1] ?? '';
  cells[sozColumn.fullMonthL4] =
    draft.totals.nominalHours > 0 &&
    draft.absences.l4Hours >= draft.totals.nominalHours
      ? 'Tak'
      : 'Nie';
  cells[sozColumn.normalHours] = formatNumber(draft.workTime.normalWorkHours);
  cells[sozColumn.nightHours] = formatNumber(draft.workTime.nightHours);
  cells[sozColumn.overtime50] = formatNumber(
    draft.workTime.paidOvertime50Hours,
  );
  cells[sozColumn.overtime100] = formatNumber(
    draft.workTime.paidOvertime100Hours,
  );
  cells[sozColumn.employeeNominal] = formatNumber(draft.totals.nominalHours);
  cells[sozColumn.monthNominal] = formatNumber(monthNominalHours);
  cells[sozColumn.nnHours] = formatNumber(draft.absences.nnHours);
  const absence = (code: string) =>
    draft.absences.groups.find((absenceGroup) => absenceGroup.code === code)
      ?.nominalHours ?? 0;
  cells[sozColumn.nuHours] = formatNumber(absence('NU'));
  cells[sozColumn.niHours] = formatNumber(absence('NI'));
  cells[sozColumn.vacationHours] = formatNumber(absence('UW'));
  cells[sozColumn.unpaidVacationHours] = formatNumber(absence('UB'));
  cells[sozColumn.care188Hours] = formatNumber(absence('OP'));
  cells[sozColumn.occasionalLeaveHours] = formatNumber(absence('UO'));
  cells[sozColumn.l4Hours] = formatNumber(draft.absences.l4Hours);
  cells[sozColumn.benefitLeaveHours] = formatNumber(absence('LO'));
  cells[sozColumn.careLeaveHours] = formatNumber(absence('O5'));
  cells[sozColumn.forceMajeureHours] = formatNumber(absence('SR'));
  cells[sozColumn.niedoczasHours] = formatNumber(draft.absences.gnHours);
  if (draft.components.companyAccommodationMediaDeduction > 0) {
    cells[sozColumn.companyHousingMediaAmount] = formatNumber(
      draft.components.companyAccommodationMediaDeduction,
    );
    cells[sozColumn.companyHousingMediaTax] = 'Netto';
    cells[sozColumn.companyHousingMediaDescription] =
      'Potrącenie za media – mieszkanie od Spółki';
  }
  if (draft.components.companyAccommodationRentDeduction > 0) {
    cells[sozColumn.companyHousingRentAmount] = formatNumber(
      draft.components.companyAccommodationRentDeduction,
    );
    cells[sozColumn.companyHousingRentTax] = 'Netto';
    cells[sozColumn.companyHousingRentDescription] = 'Mieszkanie od Spółki';
  }
  if (draft.components.manualDecreases > 0) {
    cells[sozColumn.otherDeductionAmount] = formatNumber(
      draft.components.manualDecreases,
    );
    cells[sozColumn.otherDeductionTax] = 'Netto';
    cells[sozColumn.otherDeductionDescription] = 'Korekta ręczna';
  }
  if (draft.components.housingDepositWithholding > 0) {
    cells[sozColumn.housingDepositWithholdingAmount] = formatNumber(
      draft.components.housingDepositWithholding,
    );
    cells[sozColumn.housingDepositWithholdingTax] = 'Netto';
    cells[sozColumn.housingDepositWithholdingDescription] = 'Kaucja';
  }
  if (draft.components.housingDepositReturn > 0) {
    cells[sozColumn.housingDepositReturnAmount] = formatNumber(
      draft.components.housingDepositReturn,
    );
    cells[sozColumn.housingDepositReturnTax] = 'Netto';
    cells[sozColumn.housingDepositReturnDescription] = 'Kaucja - Zwrot';
  }
  if (draft.components.ownHousingAllowanceBrutto > 0) {
    cells[sozColumn.ownHousingAmount] = formatNumber(
      draft.components.ownHousingAllowanceBrutto,
    );
    cells[sozColumn.ownHousingTax] = 'Brutto';
    cells[sozColumn.ownHousingDescription] = 'Dodatek za mieszkanie';
  }
  cells[sozColumn.transportAmount] = formatNumber(
    draft.components.transportAllowanceNetto,
  );
  cells[sozColumn.transportTax] = 'Netto';
  cells[sozColumn.transportDescription] = 'Dodatek za dojazd do pracy';
  cells[sozColumn.frequencyBonusAmount] = formatNullableNumber(
    draft.components.frequencyBonusBrutto,
  );
  cells[sozColumn.frequencyBonusTax] = 'Brutto';
  cells[sozColumn.frequencyBonusDescription] = 'Premia frekwencyjna';
  const premiumSlots = [
    {
      amount: sozColumn.clientBonusAmount,
      tax: sozColumn.clientBonusTax,
      description: sozColumn.clientBonusDescription,
    },
    {
      amount: sozColumn.additionalClientBonusAmount,
      tax: sozColumn.additionalClientBonusTax,
      description: sozColumn.additionalClientBonusDescription,
    },
  ];
  additionalSozPremiums(draft)
    .slice(0, premiumSlots.length)
    .forEach((premium, index) => {
      const slot = premiumSlots[index]!;
      cells[slot.amount] = formatNumber(premium.amount);
      cells[slot.tax] = premium.tax;
      cells[slot.description] = premium.description;
    });
  cells[sozColumn.laundryAmount] = formatNumber(
    draft.components.laundryAllowanceBrutto,
  );
  cells[sozColumn.laundryTax] = 'Brutto';
  cells[sozColumn.laundryDescription] = 'Ekwiwalent za prania';

  return { cells, group, tetaNumber: record.employee.tetaNumber };
}

function mapSozOvertimeNoteEntry(
  record: SettlementExportRecord,
): SozOvertimeNoteEntry | null {
  const draft = record.draft;
  const coveringNiedoczas50Hours = draft.workTime.shortageCovered50Hours;
  const coveringNiedoczas100Hours = draft.workTime.shortageCovered100Hours;
  const timeOffEntries = draft.absences.periods
    .filter((period) => period.code === 'NI' && period.overtimeTimeOff)
    .flatMap((period) =>
      period.workingDates.map((workingDate) => {
        const demandId = `time-off:${period.id}:${workingDate.date}`;
        const sources = draft.workTime.overtimeAllocations
          .filter((allocation) => allocation.demandId === demandId)
          .map((allocation) => ({
            date: allocation.sourceDate,
            rate: allocation.rate,
            hours: allocation.hours,
          }));
        const allocatedHours = sources.reduce(
          (total, source) => total + source.hours,
          0,
        );
        return {
          date: workingDate.date,
          requiredHours: workingDate.hours,
          allocatedHours,
          unresolvedHours: Math.max(0, workingDate.hours - allocatedHours),
          note: period.note ?? '',
          sources,
        };
      }),
    );
  const ordinaryNiNotes = draft.absences.periods
    .filter(
      (period) =>
        period.code === 'NI' &&
        !period.overtimeTimeOff &&
        Boolean(period.note?.trim()),
    )
    .map((period) => ({
      startDate: period.startDate,
      endDate: period.endDate,
      note: period.note?.trim() ?? '',
    }));

  if (
    coveringNiedoczas50Hours +
      coveringNiedoczas100Hours +
      timeOffEntries.length +
      ordinaryNiNotes.length <=
    0
  ) {
    return null;
  }

  return {
    employeeLabel: employeeName(record),
    tetaNumber: record.employee.tetaNumber,
    citizenshipGroup:
      record.employee.citizenship === 'PL' ? 'Polska' : 'Cudzoziemcy',
    employeeNominalHours: draft.totals.nominalHours,
    shortageBeforeCompensationHours:
      draft.workTime.niedoczasHours +
      coveringNiedoczas50Hours +
      coveringNiedoczas100Hours,
    sozOvertime50Hours: draft.workTime.overtime50Hours,
    sozOvertime100Hours: draft.workTime.overtime100Hours,
    timeOffHours: draft.workTime.timeOffHours,
    timeOffAllocatedHours: draft.workTime.timeOffAllocatedHours,
    timeOffUnresolvedHours: draft.workTime.timeOffUnresolvedHours,
    paidOvertime50Hours: draft.workTime.paidOvertime50Hours,
    paidOvertime100Hours: draft.workTime.paidOvertime100Hours,
    coveringNiedoczas50Hours,
    coveringNiedoczas100Hours,
    timeOffEntries,
    ordinaryNiNotes,
    note: timeOffEntries.length
      ? `Odbiór wolnego: ${formatNumber(draft.workTime.timeOffAllocatedHours)} h rozliczono z wcześniejszych nadgodzin.`
      : '',
  };
}

function mapAbsenceExportRows(record: SettlementExportRecord) {
  const group = classifySozWorkerByCitizenship(record.employee.citizenship);
  if (group === 'missing-identity') return [];

  return record.draft.absences.periods.map((period) => {
    const timeOffAllocations = period.overtimeTimeOff
      ? record.draft.workTime.overtimeAllocations.filter((allocation) =>
          allocation.demandId.startsWith(`time-off:${period.id}:`),
        )
      : [];
    const sourceDescription = timeOffAllocations.length
      ? timeOffAllocations
          .map(
            (allocation) =>
              `${allocation.sourceDate} (${allocation.rate}%): ${formatNumber(allocation.hours)} h`,
          )
          .join(', ')
      : '';
    const noteParts = [
      period.overtimeTimeOff ? 'Odbiór wolnego za nadgodziny' : '',
      sourceDescription ? `Źródła: ${sourceDescription}` : '',
      period.note?.trim() ?? '',
    ].filter(Boolean);
    return {
      group,
      lastName: record.employee.lastName,
      firstName: record.employee.firstName,
      passport:
        record.identity?.passport?.trim() ||
        record.identity?.foreignDocument?.trim() ||
        '',
      pesel: record.identity?.pesel?.trim() ?? '',
      type: absenceTypeName(period.code),
      code: period.code,
      startDate: period.startDate,
      endDate: period.endDate,
      workingDayCount: period.workingDayCount,
      workingHours: period.workingHours,
      note: noteParts.join('; '),
    } satisfies AbsenceExportRow & {
      group: Exclude<SozWorkerGroup, 'missing-identity'>;
    };
  });
}

function identityValue(
  identity: ExportEmployeeIdentity | null | undefined,
  group: Exclude<SozWorkerGroup, 'missing-identity'>,
) {
  if (group === 'foreign') {
    return (
      identity?.passport?.trim() || identity?.foreignDocument?.trim() || ''
    );
  }
  return identity?.pesel?.trim() ?? '';
}

function employeeName(record: SettlementExportRecord) {
  return `${record.employee.lastName} ${record.employee.firstName}`;
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : '';
}

function formatNullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : formatNumber(value);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value) || value === 0) {
    return value === 0 ? '0' : '';
  }
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('pl-PL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
}

function escapeCsvCell(value: string) {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function renderXlsxWorkbook({
  sheetName,
  headers,
  rows,
  unfinished,
}: {
  sheetName: string;
  headers: readonly string[];
  rows: readonly string[][];
  unfinished: boolean;
}) {
  const values = [
    ...(unfinished ? [[`ROZLICZENIE NIEZAKOŃCZONE — wymaga weryfikacji`]] : []),
    [...headers],
    ...rows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(values);
  const headerRow = unfinished ? 1 : 0;
  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(34, Math.max(10, header.length / 1.8)),
  }));
  worksheet['!rows'] = values.map((_, index) => ({
    hpt: index === headerRow ? 70 : index === 0 && unfinished ? 24 : 18,
  }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range(
      { r: headerRow, c: 0 },
      { r: headerRow, c: headers.length - 1 },
    ),
  };
  if (unfinished) {
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    ];
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const output = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer;
  return new Uint8Array(output);
}

function renderCompensationWorkbook(entries: readonly SozOvertimeNoteEntry[]) {
  const headers = [
    'Pracownik',
    'TETA',
    'Grupa obywatelstwa',
    'Nominał pracownika',
    'Niedoczas przed odróbką',
    'Godziny 50 surowe',
    'Godziny 100 surowe',
    'Odbiór wolnego wymagany',
    'Odbiór wolnego rozliczony',
    'Odbiór wolnego nierozliczony',
    'Odróbka z 50%',
    'Odróbka z 100%',
    'Odróbka razem',
    'Pozostałe 50%',
    'Pozostałe 100%',
    'Wyjaśnienie',
  ];
  return renderXlsxWorkbook({
    sheetName: 'Odróbka niedoczasu',
    headers,
    rows: entries.map((entry) => [
      entry.employeeLabel,
      entry.tetaNumber,
      entry.citizenshipGroup,
      formatNumber(entry.employeeNominalHours),
      formatNumber(entry.shortageBeforeCompensationHours),
      formatNumber(entry.sozOvertime50Hours),
      formatNumber(entry.sozOvertime100Hours),
      formatNumber(entry.timeOffHours),
      formatNumber(entry.timeOffAllocatedHours),
      formatNumber(entry.timeOffUnresolvedHours),
      formatNumber(entry.coveringNiedoczas50Hours),
      formatNumber(entry.coveringNiedoczas100Hours),
      formatNumber(
        entry.coveringNiedoczas50Hours + entry.coveringNiedoczas100Hours,
      ),
      formatNumber(entry.paidOvertime50Hours),
      formatNumber(entry.paidOvertime100Hours),
      entry.note,
    ]),
    unfinished: false,
  });
}
