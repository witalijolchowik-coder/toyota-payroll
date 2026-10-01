import * as XLSX from 'xlsx';
import type {
  BalanceSourceFactsDocument,
  IsoDate,
  MonthId,
} from '../../types/firestore';

export interface BalanceImportRow {
  tetaNumber: string;
  firstName: string;
  lastName: string;
  date: IsoDate;
  facts: BalanceSourceFactsDocument;
  issues: string[];
}

export interface BalanceParseResult {
  sheetCount: number;
  sectionCount: number;
  dailyRowCount: number;
  rows: BalanceImportRow[];
  issues: { worksheet: string; row: number; reason: string }[];
  exactDuplicates: number;
}

const normalize = (v: unknown) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const headerKey = (v: unknown) => normalize(v).toLocaleUpperCase('pl-PL');
const round = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** The source report uses H,MM durations; Excel time serials are day fractions. */
export function parseBalanceDuration(cell?: XLSX.CellObject): number {
  if (!cell || normalize(cell.v) === '') return 0;
  if (typeof cell.v === 'number') {
    if (cell.z && /[hms]/i.test(String(cell.z))) return round(cell.v * 24);
    if (Number.isFinite(cell.v)) return cell.v;
  }
  const text = normalize(cell.v);
  const match = /^(-?)(\d+)[,:.](\d{2})$/.exec(text);
  if (match) {
    const minutes = Number(match[3]);
    if (minutes > 59) throw Error('INVALID_HOUR_MINUTE_DURATION');
    return round((Number(match[2]) + minutes / 60) * (match[1] ? -1 : 1));
  }
  if (/^-?\d+$/.test(text)) return Number(text);
  throw Error('INVALID_DURATION');
}

export function parseBalanceClock(cell?: XLSX.CellObject): string | null {
  if (!cell || normalize(cell.v) === '') return null;
  if (typeof cell.v === 'number' && cell.z && /[hms]/i.test(String(cell.z))) {
    const minutes = Math.round((((cell.v % 1) + 1) % 1) * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const text = normalize(cell.v);
  // Legacy text zeros are placeholders, not evidence of a midnight punch.
  if (/^0{1,2}[,.]00$/.test(text) || text === '0') return null;
  const match = /^(\d{1,2})[:,.](\d{2})$/.exec(text);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw Error('INVALID_CLOCK');
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

function parseDate(cell?: XLSX.CellObject): string | null {
  if (!cell) return null;
  if (cell.v instanceof Date) return cell.v.toISOString().slice(0, 10);
  if (typeof cell.v === 'number') {
    const d = XLSX.SSF.parse_date_code(cell.v);
    return d
      ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      : null;
  }
  const value = normalize(cell.v);
  const m = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(value);
  const date = m
    ? `${m[3]}-${m[2]}-${m[1]}`
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : null;
  return date &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function parseBalanceWorkbook(
  workbook: XLSX.WorkBook,
  monthId: MonthId,
  importId = 'preview',
): BalanceParseResult {
  const result: BalanceParseResult = {
    sheetCount: workbook.SheetNames.length,
    sectionCount: 0,
    dailyRowCount: 0,
    rows: [],
    issues: [],
    exactDuplicates: 0,
  };
  const byKey = new Map<string, BalanceImportRow>();
  const conflicts = new Set<string>();
  for (const worksheet of workbook.SheetNames) {
    const sheet = workbook.Sheets[worksheet];
    if (!sheet?.['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    let tetaNumber = '',
      firstName = '',
      lastName = '';
    let columns = new Map<string, number>();
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const text = normalize(sheet[XLSX.utils.encode_cell({ r, c })]?.v);
        const teta = /^Nr\s+ewidencyjny\s*:\s*(.+)$/i.exec(text);
        if (teta) tetaNumber = normalize(teta[1]).toUpperCase();
        const first = /^Imię\s*:\s*(.+)$/i.exec(text);
        if (first) firstName = normalize(first[1]);
        const last = /^Nazwisko\s*:\s*(.+)$/i.exec(text);
        if (last) lastName = normalize(last[1]);
        if (headerKey(text) === 'DZIEŃ') {
          columns = new Map();
          for (let col = c; col <= range.e.c; col++)
            columns.set(
              headerKey(sheet[XLSX.utils.encode_cell({ r, c: col })]?.v),
              col,
            );
          result.sectionCount++;
          break;
        }
      }
      if (!columns.has('DZIEŃ')) continue;
      const get = (header: string) => {
        const c = columns.get(headerKey(header));
        return c === undefined
          ? undefined
          : (sheet[XLSX.utils.encode_cell({ r, c })] as
              XLSX.CellObject | undefined);
      };
      const date = parseDate(get('Dzień'));
      if (!date || date.slice(0, 7) !== monthId) continue;
      result.dailyRowCount++;
      try {
        for (const h of [
          'GODZ_PLAN',
          'GODZ_RAZ',
          'GODZ_ZLEC',
          'GODZ_NOC',
          'GODZ_WE',
          'GODZ_WY',
          'GODZ_WE_KAL',
          'GODZ_WY_KAL',
        ])
          if (!columns.has(headerKey(h))) throw Error(`MISSING_HEADER:${h}`);
        if (!tetaNumber) throw Error('MISSING_TETA');
        const duration = (h: string) => parseBalanceDuration(get(h));
        const facts: BalanceSourceFactsDocument = {
          version: 1,
          import_id: importId,
          worksheet,
          row: r + 1,
          planned_start_time: parseBalanceClock(get('GODZ_WE_KAL')),
          planned_end_time: parseBalanceClock(get('GODZ_WY_KAL')),
          actual_start_time: parseBalanceClock(get('GODZ_WE')),
          actual_end_time: parseBalanceClock(get('GODZ_WY')),
          planned_hours: duration('GODZ_PLAN'),
          credited_hours: duration('GODZ_RAZ'),
          extra_hours: duration('GODZ_ZLEC'),
          night_hours: duration('GODZ_NOC'),
          presence_hours: duration('CZAS RECZ.'),
          absence_hours: duration('GODZ_ABS'),
          private_time_hours: duration('CZAS_PRYW.'),
          private_time_repaid_hours: duration('ODPR.CZ.PRYW.'),
          private_time_balance_hours: duration('SALDO_CZ.P.'),
          client_overtime_50_hours: duration('NADG.DO ZAPŁ.50%'),
          client_overtime_100_hours: duration('NADG. DO ZAPŁ.100%'),
          client_time_off_hours: duration('GODZ_ODEB.'),
          client_time_off_due_hours: duration('GODZ_DO_ODB.'),
          client_day_off: duration('ODBIÓR_DNIA'),
          client_day_off_due: duration('DZIEŃ_DO_ODB.'),
        };
        for (const [key, value] of Object.entries(facts))
          if (
            typeof value === 'number' &&
            key !== 'row' &&
            key !== 'version' &&
            (!Number.isFinite(value) ||
              Math.abs(value) > 744 ||
              (key !== 'private_time_balance_hours' && value < 0))
          )
            throw Error(`INVALID_SOURCE:${key}`);
        if (
          [
            facts.planned_hours,
            facts.credited_hours,
            facts.extra_hours,
            facts.night_hours,
          ].some((value) => value > 24)
        )
          throw Error('INVALID_DAILY_HOURS');
        const row: BalanceImportRow = {
          tetaNumber,
          firstName,
          lastName,
          date,
          facts,
          issues: [],
        };
        if (facts.extra_hours > facts.credited_hours)
          row.issues.push('EXTRA_EXCEEDS_CREDITED_HOURS');
        // Some legacy absence rows retain planned night hours even with zero work.
        // Preserve that source conflict instead of dropping the entire day.
        if (facts.night_hours > facts.credited_hours)
          row.issues.push('NIGHT_EXCEEDS_CREDITED_HOURS');
        if (
          facts.credited_hours > 0 &&
          (!facts.actual_start_time || !facts.actual_end_time)
        )
          row.issues.push('MISSING_PUNCH');
        const key = `${tetaNumber}:${date}`,
          old = byKey.get(key);
        if (old) {
          const quantities = (f: BalanceSourceFactsDocument) => {
            const { worksheet: _s, row: _r, ...rest } = f;
            void _s;
            void _r;
            return JSON.stringify(rest);
          };
          if (quantities(old.facts) === quantities(facts))
            result.exactDuplicates++;
          else {
            conflicts.add(key);
            result.issues.push({
              worksheet,
              row: r + 1,
              reason: `DUPLICATE_SOURCE:${key}`,
            });
          }
        } else byKey.set(key, row);
      } catch (e) {
        result.issues.push({
          worksheet,
          row: r + 1,
          reason: e instanceof Error ? e.message : 'INVALID_ROW',
        });
      }
    }
  }
  result.rows = [...byKey.entries()]
    .filter(([key]) => !conflicts.has(key))
    .map(([, row]) => row);
  return result;
}
