# Employee import templates and bulk updates — Block 15

> The bulk-update column list and employee medical/contact extensions are
> superseded by
> [Employee update template and medical examinations](employee-update-medical-data.md).
> The preview-first workflow and non-payroll scope below remain applicable.

This block replaces the normal coordinator-facing employee import workflow with
application-owned CSV templates.

## Long-term import strategy

Toyota and SOZ settlement files are not the normal employee onboarding
interface. They may be useful for troubleshooting or legacy reconstruction, but
they are not reliable sources for future starters or employees not yet present
in a settlement file.

The normal workflow is now:

1. Download a CSV template from the application.
2. Fill it outside the app.
3. Upload it back to the application.
4. Review a preview.
5. Confirm selected safe writes.

No write is performed on upload alone.

## CSV format

The templates use:

- UTF-8 with BOM;
- semicolon delimiter;
- one header row;
- no informational row that would need special parser handling.

This is intended to open cleanly in Polish Excel environments.

## New employee template

File name:

`szablon_importu_nowych_pracownikow.csv`

Supported columns:

- `Numer TETA` — required;
- `Imię` — required;
- `Nazwisko` — required;
- `PESEL` — optional;
- `Paszport` — optional;
- `Inny dokument` — optional;
- `Data rozpoczęcia pracy` — required;
- `Data zakończenia pracy` — optional;
- `Dział` — optional;
- `Zmiana` — optional (`RED`, `WHITE`, `BLUE`).

The template intentionally does not include phone, private email or housing
columns because the current employee document model does not safely store them
as employee master data.

### Creation rules

The app may create only selected valid `new` rows.

Creation is blocked when:

- TETA is missing;
- first name is missing;
- last name is missing;
- employment start is missing or invalid;
- employment end is invalid;
- date range is invalid;
- shift value is invalid;
- TETA is duplicated inside the file;
- identity conflicts with another existing employee.

Existing employees are detected by TETA and are not overwritten.

Secondary duplicate/conflict checks use PESEL, passport and foreign document
number where available.

Blank optional fields are saved as blank/null. The app must not invent values.

## Bulk employee update template

File name:

`szablon_aktualizacji_pracownikow.csv`

The downloaded update template is prefilled with active employees who have not
ended employment before the download date.

Rows are matched by TETA only. Name matching is not used to find an employee.

If TETA is missing or does not match an existing employee, the row is blocked.

If TETA matches but the name differs, the preview shows a warning. Safe changes
may still be applied after coordinator confirmation.

## Blank cells and clear marker

For the update template:

- non-empty editable cells are treated as intended updates;
- blank editable cells mean no change;
- blank cells must not erase existing values.

To explicitly clear a nullable field, use:

`__CLEAR__`

Supported clearable fields:

- PESEL;
- passport;
- foreign document;
- employment start/end date;
- department;
- shift.

## Preview statuses

New employee import statuses:

- new;
- existing;
- duplicate;
- conflict;
- blocked.

Bulk update statuses:

- ready;
- warning;
- blocked;
- no changes.

Only selected `new`, `ready` or `warning` rows are written.

## Department handling

Department is optional.

If the value is blank:

- new employee import leaves department unassigned;
- bulk update leaves department unchanged.

If the value safely matches exactly one existing active department, that
department is used.

Unknown departments produce a warning and are not created automatically.

`NA0` is a temporary/code name for Toyota projects and must not be mapped
automatically to PU or Headliner. If `NA0` appears, the row shows a warning and
department remains unassigned/unchanged.

## Shift handling

Shift is optional.

Supported values:

- `RED`;
- `WHITE`;
- `BLUE`.

Blank shift means unassigned for new employees and no change for bulk update.
The app must not guess shift.

## Housing handling

Housing columns are not included in the Block 15 templates.

Company accommodation and own-housing allowance remain effective-dated employee
entitlements. They require explicit safe handling and should be managed through
the existing entitlement UI until a dedicated import format is specified.

## Security

The workflow uses the existing authenticated client services and Firestore
rules. It does not create public import endpoints and does not weaken security
rules.

## Explicit non-goals

This block does not import:

- settlement hours;
- absences;
- bonuses;
- adjustments;
- SOZ monthly values;
- Toyota monthly values;
- UDT assignments;
- payroll calculations;
- ZUS/PIT/tax/net salary data.

Existing employees must not be deleted, recreated or reset.
