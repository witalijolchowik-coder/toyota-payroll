# Monthly Settlement Review & Corrections

This document defines the coordinator review workflow for `Rozliczenie
miesięczne`.

Review is a control layer. It is not payroll closing, does not freeze source
data, and does not create an immutable final payroll snapshot.

## Review statuses

Each employee-month settlement may have one persisted review state:

- `Robocze` — default state when no review decision has been recorded yet.
- `Wymaga sprawdzenia` — coordinator explicitly marked the row for review.
- `Wymaga korekty` — coordinator found a problem that must be corrected in one
  of the existing source modules.
- `Sprawdzone` — coordinator checked the employee-month draft and accepted it
  for future export/closing work.

The status may be changed while the month is open. Settled months are read-only
according to existing month-lock rules.

## Review state persistence

Review state is stored under the payroll month:

```text
/months/{monthId}/reviewStates/{employeeId}
```

The document stores `employee_id`, `teta_number`, `month_id`, `review_status`,
`review_note`, `reviewed_at`, `reviewed_by`, and standard modification
metadata.

Employee names are not duplicated. Names are resolved from `/employees` in the
UI.

## Warning grouping

The review UI groups existing draft warnings into practical coordinator areas:

- employment;
- attendance / daily values;
- absences;
- overtime / private time;
- settlement components;
- configuration.

The UI may also surface derived review issues from existing draft quantities,
for example uncovered private time, uncovered coverable NI, or niedoczas. These
derived issues do not change settlement calculation results.

## Correction navigation

The review layer must not introduce a new correction system. Corrections remain
in the existing modules:

- hours, work-time corrections and absence conflicts: Monthly Settlement
  calendar / employee calendar;
- absence documents: Nieobecności;
- UDT, own housing and company accommodation assignment: Pracownicy /
  Uprawnienia i przypisania;
- global rates and accommodation variants: Ustawienia;
- manual increases/decreases: Korekty.

The review UI may provide action buttons or clear labels pointing the
coordinator to these modules.

## Month readiness

Readiness is only an informational signal for a future export/closing stage.

A month is ready for future export when:

- every participating employee has review status `Sprawdzone`;
- no employee is marked `Wymaga korekty`;
- no employee has unresolved review issues.

Readiness does not export, close, settle, freeze, or send payroll data.

## Limitations

- No ZUS, PIT, tax, net salary, payslip, report export, import engine or payroll
  closing is introduced by this block.
- Review status does not affect calculation outputs.
- The future closing stage must decide how reviewed drafts become immutable
  snapshots.
