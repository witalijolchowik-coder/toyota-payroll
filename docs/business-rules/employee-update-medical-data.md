# Employee update template and medical examinations

This specification extends the existing employee register and Block 15 bulk
update flow. It does not create a parallel employee model.

## Attached-template analysis

The real pre-change template was a UTF-8 CSV with BOM, semicolon delimiter, 53
employee rows and 10 columns. Besides TETA, first name and surname, it exported
current PESEL, passport, employment dates, department and color group. That
made the file behave like a personal-data export rather than a clean update
form. `Inny dokument` was also exposed although it has no coordinator-facing
business use.

No real row or personal value from the reference file is stored in this
repository or in test fixtures.

## Clean update template

Every download is generated from the current relevant employee list. Rows are
ordered by TETA. Only these reference columns are populated:

1. `Numer TETA`
2. `Imię`
3. `Nazwisko`

The complete column order is:

1. `Numer TETA`
2. `Imię`
3. `Nazwisko`
4. `Numer telefonu`
5. `PESEL`
6. `Paszport`
7. `Obywatelstwo`
8. `Płeć`
9. `Data pierwszego zatrudnienia w Toyota`
10. `Data rozpoczęcia pracy`
11. `Data zakończenia pracy`
12. `Dział`
13. `Grupa zmianowa`
14. `Data badania lekarskiego`
15. `Badanie ważne do`
16. `Typ badania lekarskiego`

All columns from 4 through 16 are empty on every download. Current employee
values, earlier uploads and browser state must never populate them.

`Inny dokument` is retained only as a backward-compatible internal employee
field. It is not downloaded, parsed or shown in the normal update workflow.

## Matching and update semantics

TETA is the only matching key. A missing, unknown or ambiguous TETA blocks the
row. First name and surname are reference checks: a mismatch blocks the row and
never renames the employee.

An empty editable cell means no change. The existing explicit `__CLEAR__`
marker remains available for nullable fields. A populated valid cell updates
only that field. Preview shows the old and new value before any write.

Department and color-group changes use the existing effective-dated assignment
flow. Because the template deliberately has no assignment date, an imported
assignment change becomes effective on the application date. Existing
assignment history is retained.

One employee update, its assignment correction and the standard audit entry
are committed in a single Firestore batch. The bulk-import audit additionally
records a batch identifier, employee ID, TETA, changed field names, before and
after values, actor, outcome and timestamp. Employee names and the full CSV are
not stored as authoritative audit relationships.

## Contact, citizenship and gender

Telephone is stored as a string. Leading/trailing whitespace and repeated
spaces are normalized; international prefixes, leading zeroes and common
separators are preserved.

Citizenship is stored as an ISO 3166-1 alpha-2 code. Case is normalized to
uppercase and the complete code is validated. `PL` is routed to Polish SOZ;
every other valid country code is routed to foreign SOZ. Unknown codes are
errors and are never guessed.

The canonical gender values are `K` and `M`. The importer accepts harmless
case differences and the Polish labels `Kobieta` and `Mężczyzna`. The existing
Toyota export `Plec` column uses the stored canonical value.

## Medical examination model

Employee documents may contain:

- `medical_examination_date`;
- `medical_valid_until`;
- `medical_examination_type`.

Business types:

| Code              | Polish label              | Expected departments    |
| ----------------- | ------------------------- | ----------------------- |
| `PRODUKCJA`       | Pracownik produkcji       | Metal, Montaż, Szwalnia |
| `MAGAZYNIER`      | Magazynier                | Magazyn                 |
| `PRODUKCJA_HL_PU` | Pracownik produkcji HL/PU | Headliner, PU           |

The importer uses the Polish labels and never exposes technical codes as normal
input. A type/department mismatch is a visible warning, not an automatic
change and not a payroll blocker.

The canonical status helper can report simultaneous issues. Its primary date
status is one of:

- `Ważne`;
- `Wygasa w ciągu 10 dni`;
- `Wygasło`;
- `Brak daty ważności`;
- `Brak danych badania`.

`Niezgodne z działem` is an additional compatibility issue. The 10-day window
uses calendar days and includes the validity end date. The Dashboard aggregates
expired, expiring, missing-validity and incompatible active employees from the
same helper used by employee editing and import preview.

Medical warnings are operational HR notices only. They do not change payroll
formulas or block monthly calculation and exports.

## Security

Employee documents remain available only to authenticated active approved
users. Firestore Rules allow the narrow new fields, validate phone as nullable
text, citizenship as an uppercase two-letter code, gender and medical type
against their enums, medical values as timestamps, and reject an end date
earlier than the examination date. Public and inactive access remains denied.
