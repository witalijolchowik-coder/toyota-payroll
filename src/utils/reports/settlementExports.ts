import type { Employee, MonthId } from '../../types/firestore';
import type { EmployeeMonthlyCalculationDraft } from '../payroll';

export type SozWorkerGroup = 'polish' | 'foreign' | 'missing-identity';
export type ExportReadinessWarningCode =
  'not-reviewed' | 'unresolved-issues' | 'missing-identity' | 'empty-export';

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
  employee: Pick<
    Employee,
    | 'id'
    | 'tetaNumber'
    | 'firstName'
    | 'lastName'
    | 'employmentStartDate'
    | 'employmentEndDate'
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
  sozOvertime50Hours: number;
  sozOvertime100Hours: number;
  paidOvertime50Hours: number;
  paidOvertime100Hours: number;
  coveringNiedoczas50Hours: number;
  coveringNiedoczas100Hours: number;
}

export interface SettlementExportPackage {
  monthId: MonthId;
  toyota: {
    fileName: string;
    headers: string[];
    rows: ToyotaExportRow[];
    excelXml: string;
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
  };
  warnings: ExportReadinessWarning[];
}

export const TOYOTA_EXPORT_HEADERS = [
  'Ip',
  'Nazwisko',
  'Imię',
  'dział',
  'Data zatrudnienia ',
  'Data zwolnienia ',
  ...Array.from({ length: 31 }, (_, index) => String(index + 1)),
  'Suma godzin',
  'RNS',
  'Niedoczas',
  'Odróbka za niedoczas 50%',
  'Odróbka za niedoczas 100%',
  'Nadgodziny 50% do wypłaty',
  'Nadgodziny 100% do wypłaty',
  'Godziny nocne',
  'L4',
  'Urlop',
  'Inne nieobecności',
  'Premia frekwencyjna',
  'Dodatek transportowy netto',
  'Ekwiwalent za pranie',
  'UDT',
  'Potrącenia',
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
  const toyotaRows = sortedRecords.map((record, index) =>
    mapToyotaExportRow(record, index + 1),
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

  return {
    monthId,
    toyota: {
      fileName: `Toyota_rozliczenie_${monthId}.xls`,
      headers: [...TOYOTA_EXPORT_HEADERS],
      rows: toyotaRows,
      excelXml: renderExcelXml({
        sheetName: 'Arkusz1',
        headers: TOYOTA_EXPORT_HEADERS,
        rows: toyotaRows.map((row) => row.cells),
      }),
    },
    soz: {
      plFileName: `SOZ_TBPL_PL_${monthId}.csv`,
      foreignFileName: `SOZ_TBPL_UA_${monthId}.csv`,
      noteFileName: `SOZ_notatka_nadgodziny_niedoczas_${monthId}.txt`,
      headers: [...SOZ_CSV_HEADERS],
      polishRows,
      foreignRows,
      polishCsv: renderSozCsv(polishRows),
      foreignCsv: renderSozCsv(foreignRows),
      note,
      noteEntries,
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
    if (classifySozWorker(record.identity) === 'missing-identity') {
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
    return 'Brak odróbek za niedoczas.\r\n';
  }

  return [
    'Notatka do SOZ — nadgodziny i odróbka za niedoczas',
    '',
    'SOZ CSV nie zawiera osobnej kolumny dla „odróbka za niedoczas”. Poniżej pokazano, która część nadgodzin ujętych w CSV ma zostać wypłacona, a która pokrywa niedoczas / czas prywatny.',
    '',
    ...entries.flatMap((entry) => [
      `${entry.employeeLabel} — TETA ${entry.tetaNumber}:`,
      `- 50% w SOZ: ${formatNumber(entry.sozOvertime50Hours)} h, w tym do wypłaty ${formatNumber(entry.paidOvertime50Hours)} h i na odróbkę ${formatNumber(entry.coveringNiedoczas50Hours)} h.`,
      `- 100% w SOZ: ${formatNumber(entry.sozOvertime100Hours)} h, w tym do wypłaty ${formatNumber(entry.paidOvertime100Hours)} h i na odróbkę ${formatNumber(entry.coveringNiedoczas100Hours)} h.`,
      '',
    ]),
  ].join('\r\n');
}

function mapToyotaExportRow(
  record: SettlementExportRecord,
  ordinal: number,
): ToyotaExportRow {
  const draft = record.draft;
  const paidOvertime50 = draft.workTime.paidOvertime50Hours;
  const paidOvertime100 = draft.workTime.paidOvertime100Hours;
  const covering50 = Math.max(
    0,
    draft.workTime.overtime50Hours - paidOvertime50,
  );
  const covering100 = Math.max(
    0,
    draft.workTime.overtime100Hours - paidOvertime100,
  );
  const days = Array.from({ length: 31 }, (_, index) =>
    formatNullableNumber(
      record.dailyCells?.find((cell) => cell.dayOfMonth === index + 1)?.hours ??
        null,
    ),
  );
  return {
    tetaNumber: record.employee.tetaNumber,
    paidOvertime50Hours: paidOvertime50,
    paidOvertime100Hours: paidOvertime100,
    overtimeCoveringNiedoczas50Hours: covering50,
    overtimeCoveringNiedoczas100Hours: covering100,
    cells: [
      String(ordinal),
      record.employee.lastName,
      record.employee.firstName,
      record.departmentName ?? '',
      formatDate(record.employee.employmentStartDate),
      formatDate(record.employee.employmentEndDate),
      ...days,
      formatNumber(draft.totals.workedHours),
      formatNumber(draft.workTime.niedoczasHours),
      formatNumber(draft.workTime.niedoczasHours),
      formatNumber(covering50),
      formatNumber(covering100),
      formatNumber(paidOvertime50),
      formatNumber(paidOvertime100),
      '0',
      formatNumber(draft.absences.l4Hours),
      formatNumber(draft.absences.vacationHours),
      formatNumber(draft.absences.otherAbsenceHours),
      formatNullableNumber(draft.components.frequencyBonusBrutto),
      formatNumber(draft.components.transportAllowanceNetto),
      formatNumber(draft.components.laundryAllowanceBrutto),
      formatNumber(draft.components.udtAllowanceBrutto),
      formatNumber(draft.totals.deductions),
    ],
  };
}

function mapSozExportRow(
  record: SettlementExportRecord,
  monthId: MonthId,
  monthNominalHours: number,
): SozExportRow | null {
  const group = classifySozWorker(record.identity);
  if (group === 'missing-identity') {
    return null;
  }

  const [year, month] = monthId.split('-').map(Number);
  const draft = record.draft;
  const cells = Array.from({ length: SOZ_CSV_HEADERS.length }, () => '');
  setCell(cells, 'Nazwisko', record.employee.lastName);
  setCell(cells, 'Imię', record.employee.firstName);
  setCell(cells, 'Paszport / PESEL', identityValue(record.identity, group));
  setCell(cells, 'Rok', String(year));
  setCell(cells, 'Miesiąc', polishMonthNames[(month ?? 1) - 1] ?? '');
  setCell(
    cells,
    'Zwolnienie L4 przez cały miesiąc',
    draft.totals.nominalHours > 0 &&
      draft.absences.l4Hours >= draft.totals.nominalHours
      ? 'Tak'
      : 'Nie',
  );
  setCell(
    cells,
    'Godziny zwykłe (suma dzienne plus nocne) ',
    formatNumber(draft.workTime.normalWorkHours),
  );
  setCell(
    cells,
    'Godziny nocne (do wyliczenia dodatku za prace w porze nocnej)',
    '0',
  );
  setCell(cells, 'Godziny 50', formatNumber(draft.workTime.overtime50Hours));
  setCell(cells, 'Godziny 100', formatNumber(draft.workTime.overtime100Hours));
  setCell(
    cells,
    'Harmonogram - nominał pracownika na dany miesiąc',
    formatNumber(draft.totals.nominalHours),
  );
  setCell(cells, 'Czas nominalny', formatNumber(monthNominalHours));
  setCell(
    cells,
    'Godziny nieobecność nieusprawiedliwiona NN',
    formatNumber(draft.absences.nnHours),
  );
  setCell(cells, 'Godziny nieobecność usprawiedliwiona płatna NU', '0');
  setCell(
    cells,
    'Godziny nieobecność usprawiedliwiona bezpłatna (niepłatna) NI',
    formatNumber(draft.workTime.coverableNiHours),
  );
  setCell(
    cells,
    'Godziny urlop wypoczynkowy UW',
    formatNumber(draft.absences.vacationHours),
  );
  setCell(cells, 'Godziny urlop bezpłatny UB', '0');
  setCell(cells, 'Godziny opieka art. 188', '0');
  setCell(cells, 'Godziny chorobowe L4', formatNumber(draft.absences.l4Hours));
  setCell(
    cells,
    'Godziny niedoczas',
    formatNumber(draft.workTime.niedoczasHours),
  );
  setCell(
    cells,
    'Premia spółki 1 / Kwota',
    formatNumber(draft.components.transportAllowanceNetto),
  );
  setCell(cells, 'Premia spółki 1 / Podatek', 'Netto');
  setCell(cells, 'Premia spółki 1 / Za co', 'Dodatek za dojazd do pracy');
  setCell(
    cells,
    'Premia od klienta 5 / Kwota',
    formatNullableNumber(draft.components.frequencyBonusBrutto),
  );
  setCell(cells, 'Premia od klienta 5 / Podatek', 'Brutto');
  setCell(cells, 'Premia od klienta 5 /  Za co', 'Premia frekwencyjna');
  setCell(
    cells,
    'Premia od klienta 7 / Kwota',
    formatNumber(draft.components.laundryAllowanceBrutto),
  );
  setCell(cells, 'Premia od klienta 7 / Podatek', 'Brutto');
  setCell(cells, 'Premia od klienta 7 /  Za co', 'Ekwiwalent za prania');

  return { cells, group, tetaNumber: record.employee.tetaNumber };
}

function mapSozOvertimeNoteEntry(
  record: SettlementExportRecord,
): SozOvertimeNoteEntry | null {
  const draft = record.draft;
  const coveringNiedoczas50Hours = Math.max(
    0,
    draft.workTime.overtime50Hours - draft.workTime.paidOvertime50Hours,
  );
  const coveringNiedoczas100Hours = Math.max(
    0,
    draft.workTime.overtime100Hours - draft.workTime.paidOvertime100Hours,
  );

  if (coveringNiedoczas50Hours + coveringNiedoczas100Hours <= 0) {
    return null;
  }

  return {
    employeeLabel: employeeName(record),
    tetaNumber: record.employee.tetaNumber,
    sozOvertime50Hours: draft.workTime.overtime50Hours,
    sozOvertime100Hours: draft.workTime.overtime100Hours,
    paidOvertime50Hours: draft.workTime.paidOvertime50Hours,
    paidOvertime100Hours: draft.workTime.paidOvertime100Hours,
    coveringNiedoczas50Hours,
    coveringNiedoczas100Hours,
  };
}

function setCell(cells: string[], header: string, value: string) {
  const index = SOZ_CSV_HEADERS.indexOf(
    header as (typeof SOZ_CSV_HEADERS)[number],
  );
  if (index >= 0) {
    cells[index] = value;
  }
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

function renderExcelXml({
  sheetName,
  headers,
  rows,
}: {
  sheetName: string;
  headers: readonly string[];
  rows: readonly string[][];
}) {
  const renderRow = (cells: readonly string[]) =>
    `<Row>${cells
      .map(
        (cell) =>
          `<Cell><Data ss:Type="${isNumericCell(cell) ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`,
      )
      .join('')}</Row>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${renderRow(headers)}
   ${rows.map(renderRow).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isNumericCell(value: string) {
  return /^-?\d+(\.\d+)?$/.test(value);
}
