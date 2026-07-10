# Export formats — Block 12

This document defines the first export foundation for `Rozliczenie miesięczne`.
The application still does not calculate ZUS, PIT, taxes, net salary or full
accounting payroll.

## Source examples analysed

The June 2026 reference files were treated as target-format examples:

- Toyota Excel report: one worksheet named `Arkusz1`.
- SOZ CSV for foreign workers.
- SOZ CSV for Polish workers.

Observed format details:

- Toyota Excel uses a single combined worker list.
- Toyota Excel starts with employee identity columns, days `1`–`31`,
  `Suma godzin`, and `RNS`.
- SOZ CSV uses UTF-8 with BOM.
- SOZ CSV uses semicolon (`;`) as delimiter.
- SOZ CSV has 138 columns and PL/foreign files share the same column order.
- SOZ CSV decimal values use Polish decimal comma where needed.

## Products

### Toyota Excel

Toyota receives one combined Excel-compatible file for all Toyota workers.
Toyota does not need the internal SOZ split between Polish and foreign workers.

The export maps available monthly-settlement draft values:

- employee name;
- department;
- employment dates;
- day-by-day visible hours;
- total worked hours;
- niedoczas;
- paid overtime;
- overtime used as `odróbka za niedoczas`;
- L4, vacation and other absence hours;
- currently supported additions and deductions.

Unsupported Toyota-specific columns are left blank or omitted until their
business meaning is specified.

The current implementation generates an Excel-compatible XML spreadsheet with
`.xls` extension. This avoids introducing a heavy spreadsheet dependency before
the final Toyota template is locked. A future block may switch to `.xlsx`
template-based generation if Toyota requires exact workbook styling.

### SOZ CSV

SOZ requires two separate CSV files:

- PL workers;
- foreign workers.

Both files preserve the same 138-column structure. Unsupported fields are left
blank or `0` where the example template uses `0`.

Worker split rule:

- passport / foreign document present → foreign SOZ CSV;
- PESEL present and no passport / foreign document → Polish SOZ CSV;
- insufficient identity data → warning, do not silently assign the worker.

The current Employee Firestore model does not yet store PESEL/passport fields.
Therefore the UI and helpers prepare the split and warnings, but real SOZ rows
require a future identity-data extension.

## SOZ accompanying note

SOZ CSV has no separate column for `odróbka za niedoczas`.

When overtime is used to cover `niedoczas` / `czas prywatny`, the system must
generate an accompanying note. The coordinator must not be expected to write it
manually.

The note lists affected employees and shows:

- TETA;
- total overtime hours placed in SOZ CSV;
- overtime hours to be paid;
- overtime hours used to cover `niedoczas` / `czas prywatny`;
- split by 50% and 100%.

If there are no such cases, the note says:

`Brak odróbek za niedoczas.`

## Review readiness

Exports respect the monthly review workflow:

- unchecked employee-month records produce warnings;
- unresolved issues produce warnings;
- missing identity data produces warnings;
- warnings are visible but do not hard-block export in this block.

The export foundation does not close payroll months and does not create
immutable snapshots.

## Mapping summary

### Toyota

| Export field                           | Source                           |
| -------------------------------------- | -------------------------------- |
| `Nazwisko`, `Imię`                     | Employee register                |
| `dział`                                | Department dictionary            |
| `Data zatrudnienia`, `Data zwolnienia` | Employee employment dates        |
| Daily columns `1`–`31`                 | Visible settlement grid values   |
| `Suma godzin`                          | Monthly draft worked hours       |
| `RNS` / `Niedoczas`                    | Monthly draft niedoczas          |
| Overtime paid / odróbka                | Monthly draft work-time balance  |
| L4 / Urlop / Inne nieobecności         | Monthly draft absence groups     |
| Additions and deductions               | Current monthly draft components |

### SOZ

| SOZ field                           | Source                                     |
| ----------------------------------- | ------------------------------------------ |
| `Nazwisko`, `Imię`                  | Employee register                          |
| `Paszport / PESEL`                  | Future employee identity data              |
| `Rok`, `Miesiąc`                    | Selected payroll month                     |
| `Godziny zwykłe`                    | Monthly draft normal work hours            |
| `Godziny 50`, `Godziny 100`         | Monthly draft total overtime buckets       |
| `Harmonogram - nominał pracownika`  | Individual employee nominal hours          |
| `Czas nominalny`                    | Common month nominal hours                 |
| NN / NI / UW / L4 columns           | Current absence and work-time draft values |
| Transport, frequency bonus, laundry | Current monthly draft components           |

## Known limitations

- PESEL/passport are not yet stored on Employee documents.
- Toyota `.xlsx` exact styling is not implemented; current output is
  Excel-compatible `.xls` XML.
- SOZ imports can contain many project-wide columns not yet supported by Toyota
  Payroll; unsupported columns remain blank or `0`.
- No ZUS, PIT, tax, net salary, payslip, closing or automatic sending is
  implemented in this block.
