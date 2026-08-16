import type ExcelJS from 'exceljs';

import type { IsoDate, MonthId } from '../../types/firestore';

export interface AbsenceExportRow {
  lastName: string;
  firstName: string;
  passport: string;
  pesel: string;
  type: string;
  code: string;
  startDate: IsoDate;
  endDate: IsoDate;
  workingDayCount: number;
  workingHours: number;
  note: string;
}

const ABSENCE_HEADERS = [
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
] as const;

const ABSENCE_DICTIONARY = [
  [
    'Nieobecność pracownika w pracy bez uzasadnionego powodu.',
    'Godziny nieobecność nieusprawiedliwiona (NN)',
    'NN',
  ],
  [
    'Nieobecność pracownika w pracy z uzasadnionego powodu, za którą przysługuje mu wynagrodzenie.',
    'Godziny nieobecność usprawiedliwiona płatna (NU)',
    'NU',
  ],
  [
    'Nieobecność pracownika w pracy z uzasadnionego powodu, za którą nie przysługuje mu wynagrodzenie.',
    'Godziny nieobecność usprawiedliwiona niepłatna (NI)',
    'NI',
  ],
  [
    'Urlop udzielany pracownikowi w celu wypoczynku i regeneracji sił. Wymagany pisemny wniosek.',
    'Godziny urlop wypoczynkowy (UW)',
    'UW',
  ],
  [
    'Urlop udzielany pracownikowi na jego wniosek, za który nie przysługuje mu wynagrodzenie. Wymagany pisemny wniosek.',
    'Godziny urlop bezpłatny (UB)',
    'UB',
  ],
  [
    'Dwa dni wolnego udzielane pracownikowi na jego wniosek na opiekę nad dzieckiem do lat 14.',
    'Godziny opieka Art. 188 (OP)',
    'OP',
  ],
  [
    'Urlop okolicznościowy udzielany w związku ze zdarzeniami rodzinnymi, po przedstawieniu wymaganych dokumentów.',
    'Godziny urlop okolicznościowy (UO)',
    'UO',
  ],
  [
    'Zwolnienie lekarskie - niezdolność pracownika do pracy przez konkretny czas.',
    'Godziny chorobowe (L4)',
    'L4',
  ],
  [
    'Zwolnienie lekarskie na dziecko do lat 14 lub członka rodziny, wymagające właściwego formularza ZUS.',
    'Godziny zasiłku (opiekuńczy, macierzyński, tacierzyński) (LO)',
    'LO',
  ],
  [
    'Urlop opiekuńczy w wymiarze do 5 dni w roku, udzielany w celu zapewnienia osobistej opieki lub wsparcia. Urlop jest bezpłatny.',
    'Godziny urlopu z tyt. Art. 173 (O5)',
    'O5',
  ],
  [
    'Zwolnienie z powodu siły wyższej w pilnych sprawach rodzinnych spowodowanych chorobą lub wypadkiem.',
    'Godziny urlopu z tyt. Siły wyższej Art. 148 (SR)',
    'SR',
  ],
  [
    'Godziny, w których pracownik nie wykonywał pracy, bez prawa do wynagrodzenia.',
    'Godziny niedoczas (GN)',
    'GN',
  ],
] as const;

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

export async function renderAbsenceWorkbook(
  rows: readonly AbsenceExportRow[],
  monthId: MonthId,
) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Toyota Payroll';
  workbook.created = new Date();
  const absenceSheet = workbook.addWorksheet('Absencja', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const dictionarySheet = workbook.addWorksheet('Słownik');

  absenceSheet.columns = [
    { width: 15.8867 },
    { width: 14 },
    { width: 13.8867 },
    { width: 15.6641 },
    { width: 44.21875 },
    { width: 10.5547 },
    { width: 13.6641 },
    { width: 12.5547 },
    { width: 9.4414 },
    { width: 18.21875 },
    { width: 29.8867 },
  ];
  const header = absenceSheet.addRow([...ABSENCE_HEADERS]);
  header.height = 28.8;
  header.eachCell((cell, columnNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: columnNumber <= 4 ? 'FFFFFF00' : 'FF92D050' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = thinBorder;
  });

  rows.forEach((row) => {
    const excelRow = absenceSheet.addRow([
      row.lastName,
      row.firstName,
      row.passport || null,
      row.pesel || null,
      row.type,
      row.code,
      isoDateToLocalDate(row.startDate),
      isoDateToLocalDate(row.endDate),
      row.workingDayCount,
      row.workingHours,
      row.note,
    ]);
    excelRow.height = 18;
    excelRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: columnNumber === 6,
      };
      cell.alignment = {
        horizontal: columnNumber === 11 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = thinBorder;
      if (columnNumber === 6) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' },
        };
      }
      if (columnNumber === 7 || columnNumber === 8) {
        cell.numFmt = 'm/d/yy';
      }
    });
  });

  const minimumRows = Math.max(35, rows.length + 1);
  while (absenceSheet.rowCount < minimumRows) {
    const emptyRow = absenceSheet.addRow(
      Array(ABSENCE_HEADERS.length).fill(null),
    );
    emptyRow.height = 18;
    emptyRow.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (columnNumber === 6) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD9E1F2' },
        };
      }
    });
  }
  absenceSheet.autoFilter = `A1:K${minimumRows}`;
  for (let rowNumber = 2; rowNumber <= minimumRows; rowNumber += 1) {
    absenceSheet.getCell(`F${rowNumber}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ["'Słownik'!$C$2:$C$13"],
    };
  }

  dictionarySheet.columns = [
    { width: 80.332 },
    { width: 48.332 },
    { width: 8.777 },
  ];
  const dictionaryHeader = dictionarySheet.addRow([
    'Opis',
    'Rodzaje absencji',
    'Skrót',
  ]);
  dictionaryHeader.height = 18;
  dictionaryHeader.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  ABSENCE_DICTIONARY.forEach((dictionaryRow) => {
    const row = dictionarySheet.addRow([...dictionaryRow]);
    row.height = 48;
    row.eachCell((cell, columnNumber) => {
      cell.font = {
        name: 'Arial',
        size: 10,
        italic: columnNumber === 1,
        bold: columnNumber === 3,
      };
      cell.alignment = {
        horizontal: columnNumber === 3 ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = thinBorder;
    });
  });

  const [year, month] = monthId.split('-').map(Number);
  workbook.subject = `Absencje ${year}-${String(month).padStart(2, '0')}`;
  const output = await workbook.xlsx.writeBuffer();
  return new Uint8Array(output);
}

export function absenceTypeName(code: string) {
  return (
    ABSENCE_DICTIONARY.find((entry) => entry[2] === code)?.[1] ??
    `Godziny absencji (${code})`
  );
}

function isoDateToLocalDate(value: IsoDate) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
