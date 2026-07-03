# ADR 0008: Manual daily-value entry

- Status: Accepted
- Date: 2026-07-02

## Context

Coordinators need to correct worked hours in the monthly grid without turning
virtual defaults into stored Firestore facts. Imported values and settled
months must remain protected.

## Decision

- Make elapsed employee-day cells editable when the date is inside the
  employee's employment period and the month is open.
- Permit manual entry on working and non-working days. Future dates and dates
  outside employment remain read-only.
- Store explicit edits in canonical
  `/months/{monthId}/dailyValues/{employeeId_YYYY-MM-DD}` documents with source
  `manual`, both employee identifiers, and standard modification metadata.
- Validate finite numeric hours from `0` through `24`, including decimal
  values.
- Keep working-day `8h` and non-working-day `0h` defaults virtual.
- Do not write when the entered value equals an unchanged virtual default.
- Delete an existing manual document when it is cleared or returned to its
  virtual default.
- Keep imported base facts read-only for the browser. ADR 0009 later permits a
  separate audited `manual_override` without changing those base fields.
- Keep every daily-value cell read-only when the month is settled.

## Security

Firestore Rules continue to require authentication and an open month. Manual
creates must use a canonical ID and a date belonging to the parent month.
Updates preserve employee identity, date, source, import linkage, and creation
metadata. Deletes are allowed only for manual documents. Imported documents
cannot be deleted or have their base fields changed; ADR 0009 permits only a
narrowly scoped override update. Settled records remain protected.

## Consequences

Daily corrections are explicit and auditable without polluting Firestore with
default documents. Absence overlays, imports, adjustments, and payroll
calculation remain outside this step.

## Deferred business rules

This step does not calculate or define:

- nominal month hours;
- employee-specific nominal hours;
- bonuses;
- absence hours or absence effects;
- payroll totals or payroll-engine behavior.

Those rules require a separate approved Business Rules Specification. Manual
daily values and virtual display defaults must not be interpreted as nominal
hours or payroll results.
