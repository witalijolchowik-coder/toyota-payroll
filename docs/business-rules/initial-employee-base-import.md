# Initial employee base import — Block 14

This block introduces a safe, preview-first import for the initial employee
register.

Block 15 supersedes this as the normal coordinator-facing employee import
workflow. Toyota/SOZ settlement-file import remains a legacy/internal
troubleshooting path and must not be treated as the long-term onboarding
interface.

## Scope

The import may create only selected, valid new employee records in the
`employees` collection.

It must not import or calculate:

- worked hours;
- absences;
- payroll components;
- bonuses;
- deductions;
- monthly settlement values;
- production seed data outside explicit coordinator confirmation.

## Source files

The MVP import is based on three coordinator-provided files:

1. Toyota Excel hour summary for the target month.
2. SOZ PL CSV.
3. SOZ UA / foreign-worker CSV.

Toyota Excel is the authoritative source for employee base records because it
contains the TETA number, employee name, department hint and employment dates.
SOZ files are enrichment and validation sources only.

## Identity rules

- TETA number remains the primary business identifier.
- Firestore `employeeId` remains internal only.
- The import does not overwrite existing employees.
- Existing employee detection uses TETA first.
- PESEL, passport and foreign document number are secondary conflict checks.
- If SOZ cannot be matched safely to exactly one Toyota row, it stays blocked
  in preview.

## Required fields for creation

A row can be created only when it has:

- first name;
- last name;
- TETA number;
- employment start date.

The import must not guess missing employment start dates. Rows without a safe
start date are blocked in preview.

## Department mapping

The import may map only departments that are safe and already present in the
department dictionary:

- Metal;
- Szwalnia;
- Montaż.

`NA0` is intentionally not mapped automatically and must show a coordinator
warning. Other unrecognized departments remain empty with a warning.

Shift assignment is always left empty by the import.

## Housing hints

SOZ files can indicate housing-related facts, but employee housing assignments
are effective-dated business facts that require safe configuration.

For MVP:

- SOZ UA media/accommodation amounts are shown as company-housing hints.
- If no configured accommodation variant can be selected safely, the import
  shows a warning and does not create `COMPANY_ACCOMMODATION` automatically.
- SOZ PL own-housing amounts are shown as hints only.
- The import does not create own-housing allowance automatically.

## Preview-first workflow

The coordinator must see a preview before creation. The preview classifies rows
as:

- new;
- existing;
- duplicate;
- conflict;
- blocked.

Only selected valid `new` rows may be created. Existing, duplicate, conflicting
or blocked rows are not written.

## Security

The import uses the same authenticated employee write path as manual employee
creation. Firestore rules must not be weakened for import.
