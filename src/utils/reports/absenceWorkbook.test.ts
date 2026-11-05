import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  renderAbsenceWorkbook,
  type AbsenceExportRow,
} from './absenceWorkbook';

describe('absence workbook', () => {
  it.each([
    ['2026-09-30', '2026-10-02'],
    ['2026-10-24', '2026-11-03'],
  ] as const)(
    'exports complete date-only periods without timezone shifts: %s – %s',
    async (startDate, endDate) => {
      const bytes = await renderAbsenceWorkbook(
        [
          {
            lastName: 'TEST',
            firstName: 'JAN',
            passport: '',
            pesel: '',
            type: 'Zwolnienie lekarskie',
            code: 'L4',
            startDate,
            endDate,
            workingDayCount: 2,
            workingHours: 24,
            note: '',
          },
        ],
        '2026-10',
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
      const sheet = workbook.getWorksheet('Absencja')!;
      expect((sheet.getCell('G2').value as Date).toISOString()).toBe(
        `${startDate}T00:00:00.000Z`,
      );
      expect((sheet.getCell('H2').value as Date).toISOString()).toBe(
        `${endDate}T00:00:00.000Z`,
      );
      expect(sheet.getCell('I2').value).toBe(2);
      expect(sheet.getCell('J2').value).toBe(24);
      expect(sheet.getCell('G2').numFmt).toBe('m/d/yy');
      expect(workbook.worksheets.map((item) => item.name)).toEqual([
        'Absencja',
        'Słownik',
      ]);
    },
  );

  it('reproduces the Absencja and Słownik structure with canonical codes', async () => {
    const rows: AbsenceExportRow[] = [
      {
        lastName: 'KOWALSKI',
        firstName: 'JAN',
        passport: '',
        pesel: '87010409887',
        type: 'Godziny nieobecność usprawiedliwiona niepłatna (NI)',
        code: 'NI',
        startDate: '2026-07-10',
        endDate: '2026-07-10',
        workingDayCount: 1,
        workingHours: 8,
        note: 'Odbiór wolnego za nadgodziny',
      },
    ];

    const bytes = await renderAbsenceWorkbook(rows, '2026-07');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    const absence = workbook.getWorksheet('Absencja');
    const dictionary = workbook.getWorksheet('Słownik');

    expect(absence?.rowCount).toBe(35);
    expect(absence?.getRow(1).values).toEqual([
      undefined,
      'Nazwisko',
      'Imię',
      'Paszport',
      'Pesel',
      'Rodzaj absencji',
      'Skrót',
      'OD',
      'DO',
      'Dni robocze',
      'Przeliczenie na Godziny',
      'Uwagi',
    ]);
    expect(absence?.getCell('F2').value).toBe('NI');
    expect(absence?.getCell('A1').fill).toMatchObject({
      type: 'pattern',
      fgColor: { argb: 'FFFFFF00' },
    });
    expect(absence?.getCell('E1').fill).toMatchObject({
      type: 'pattern',
      fgColor: { argb: 'FF92D050' },
    });
    expect(dictionary?.rowCount).toBe(13);
    expect(
      Array.from(
        { length: 12 },
        (_, index) => dictionary?.getCell(index + 2, 3).value,
      ),
    ).toEqual([
      'NN',
      'NU',
      'NI',
      'UW',
      'UB',
      'OP',
      'UO',
      'L4',
      'LO',
      'O5',
      'SR',
      'GN',
    ]);
  });
});
