# Binding export references (June 2026)

The three operational files supplied for June 2026 are read-only reference
artifacts. They are not copied into the repository because they contain real
employee data. Their structures were inspected directly and are protected by
deterministic export tests.

| Reference                            | SHA-256                                                            | Required structure                                 |
| ------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------- |
| `Zestawienie godzin_ - 06.2026.xlsx` | `058630175D22956046F4F65A5B56F527C4183BCC561436597CAC4F3BF6CFC501` | sheet `Godziny`, 43 columns in the reference order |
| `SOZ TBPL_UA 06.2026 CSV.csv`        | `3BE33DF815502A342E845B9643BE8B0C1704C6F394E84402E932D94646914A32` | 138 columns, UTF-8 BOM, semicolon delimiter, CRLF  |
| `SOZ TBPL_PL 06.2026 CSV.csv`        | `47E0DA8886ED0B7388D64B2D3DC7E534EBAB43E8FDE9296195DBA99E94449EAC` | the same 138-column SOZ schema                     |

The generated client workbook keeps one combined employee list. SOZ output is
split by stored citizenship: `PL` goes to the Polish file and every other
known citizenship goes to the foreign file. Missing citizenship or the
identity document required by the target file is a blocker; it is never
guessed from a name, department or document format.

The client workbook contains overtime remaining after shortage/WZN
compensation. SOZ retains raw 50% and 100% hours. When compensation exists,
the application additionally produces a citizenship-specific workbook that
shows the allocation without changing the 138-column SOZ import schema.
