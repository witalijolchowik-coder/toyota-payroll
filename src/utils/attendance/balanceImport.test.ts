import * as XLSX from 'xlsx';
import {
  parseBalanceClock,
  parseBalanceDuration,
  parseBalanceWorkbook,
} from './balanceImport';

function workbook(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Nr ewidencyjny: wt-test'],
    ['Imię: Jan'],
    ['Nazwisko: Testowy'],
    [
      'Dzień',
      'GODZ_WE_KAL',
      'GODZ_WY_KAL',
      'GODZ_WE',
      'GODZ_WY',
      'GODZ_PLAN',
      'GODZ_RAZ',
      'GODZ_ZLEC',
      'GODZ_NOC',
    ],
    ...rows,
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Section');
  return book;
}
describe('Balance legacy workbook', () => {
  it('parses H,MM durations and formatted Excel time fractions', () => {
    expect(parseBalanceDuration({ t: 's', v: ' 8,15 ' })).toBe(8.25);
    expect(parseBalanceDuration({ t: 's', v: '4,30' })).toBe(4.5);
    expect(parseBalanceDuration({ t: 'n', v: 8 / 24, z: '[h]:mm' })).toBe(8);
    expect(() => parseBalanceDuration({ t: 's', v: '1,75' })).toThrow();
  });
  it('distinguishes placeholder zero from genuine Excel midnight', () => {
    expect(parseBalanceClock({ t: 's', v: '0,00' })).toBeNull();
    expect(parseBalanceClock({ t: 'n', v: 0, z: 'hh:mm' })).toBe('00:00');
    expect(parseBalanceClock({ t: 's', v: '00:00' })).toBe('00:00');
  });
  it('uses metadata TETA, actual headers, dates and keeps contradictory raw night facts', () => {
    const parsed = parseBalanceWorkbook(
      workbook([
        [
          '01.09.2026',
          '22,00',
          '6,00',
          '0,00',
          '0,00',
          '8,00',
          '0,00',
          '0,00',
          '8,00',
        ],
      ]),
      '2026-09',
    );
    expect(parsed.rows[0]).toMatchObject({
      tetaNumber: 'WT-TEST',
      date: '2026-09-01',
      facts: { credited_hours: 0, night_hours: 8, actual_start_time: null },
      issues: ['NIGHT_EXCEEDS_CREDITED_HOURS'],
    });
    expect(parsed.dailyRowCount).toBe(1);
    expect(parsed.issues).toEqual([]);
  });
  it('deduplicates exact rows and rejects conflicting employee/date duplicates', () => {
    const row = [
      '10.09.2026',
      '6,00',
      '14,00',
      '6,00',
      '14,00',
      '8,00',
      '8,00',
      '0,00',
      '0,00',
    ];
    expect(
      parseBalanceWorkbook(workbook([row, row]), '2026-09').exactDuplicates,
    ).toBe(1);
    const conflict = parseBalanceWorkbook(
      workbook([row, [...row.slice(0, 6), '7,00', '0,00', '0,00']]),
      '2026-09',
    );
    expect(conflict.rows).toEqual([]);
    expect(conflict.issues[0]?.reason).toContain('DUPLICATE_SOURCE');
  });
});
