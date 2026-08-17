import { describe, expect, it } from 'vitest';

import type { SettlementExportPackage } from '../utils/reports';
import { buildFinalSettlementArtifacts } from './settlementVersionService';

describe('settlement version artifacts', () => {
  it('captures the exact final package generated from one calculation state', async () => {
    const exportPackage = {
      monthId: '2026-07',
      toyota: {
        fileName: 'Zestawienie_godzin_TBPL_2026-07.xlsx',
        headers: [],
        rows: [],
        workbook: new Uint8Array([1, 2, 3]),
      },
      soz: {
        plFileName: 'SOZ_TBPL_PL_2026-07.csv',
        foreignFileName: 'SOZ_TBPL_UA_2026-07.csv',
        noteFileName: 'SOZ_notatka_nadgodziny_niedoczas_2026-07.txt',
        headers: [],
        polishRows: [],
        foreignRows: [],
        polishCsv: '\uFEFFPL;CSV\r\n',
        foreignCsv: '\uFEFFUA;CSV\r\n',
        note: 'NOTATKA',
        noteEntries: [],
        polishCompensationWorkbook: null,
        foreignCompensationWorkbook: null,
        polishCompensationFileName: null,
        foreignCompensationFileName: null,
      },
      absences: {
        plFileName: 'Absencja_PL.xlsx',
        foreignFileName: 'Absencja_UA.xlsx',
        polishRows: [],
        foreignRows: [],
      },
      warnings: [],
    } as SettlementExportPackage;

    const artifacts = await buildFinalSettlementArtifacts(exportPackage);

    expect(artifacts.map((artifact) => artifact.id)).toEqual([
      'toyota-xlsx',
      'soz-pl-csv',
      'soz-foreign-csv',
      'absence-pl-xlsx',
      'absence-foreign-xlsx',
      'soz-note',
    ]);
    expect(
      artifacts.find((artifact) => artifact.id === 'soz-pl-csv')!.content,
    ).toEqual(new TextEncoder().encode('\uFEFFPL;CSV\r\n'));
    expect(
      artifacts.find((artifact) => artifact.id === 'toyota-xlsx')!.content,
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      artifacts
        .filter((artifact) => artifact.id.startsWith('absence-'))
        .every((artifact) => artifact.content.byteLength > 0),
    ).toBe(true);
  }, 15_000);
});
