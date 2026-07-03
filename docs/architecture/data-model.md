# MVP data model

This is the final MVP shape. It supersedes the earlier enterprise collection hierarchy as the immediate build target.

## Collections

```text
/employees/{employeeId}

/months/{monthId}
  /employeeSettlements/{employeeId}
  /dailyValues/{employeeId_YYYY-MM-DD}
  /absences/{absenceId}
  /adjustments/{employeeId}
  /imports/{importId}

/reports/{reportId}
/auditLog/{entryId}
```

The paths are prepared in code and Security Rules; the foundation creates no
production documents.

## Type boundaries

Firestore documents use snake_case field names and Firestore `Timestamp`
values. Domain models use camelCase names, JavaScript `Date` values, and carry
their document IDs separately.

Runtime converters validate documents read from Firestore before they cross
into application code. Client-write input types exist only for coordinator
owned fields. Calculated settlements, generated reports, settlement fields,
and pipeline processing fields intentionally expose no client-write contract.

## Employee references

Operational documents that refer to an employee store:

```text
employee_id: Firestore document ID, internal reference
teta_number: required business identifier
```

Names are resolved from `/employees` in the UI and are not duplicated into operational documents. Generated report files may snapshot names for historical readability.

TETA is the only import-matching and external-report identifier. Firestore IDs must never be used for business matching or shown as coordinator-facing identity.

Firestore does not provide unique field constraints. TETA uniqueness therefore requires an application or server-side check when the Employees module is implemented; rules alone cannot guarantee it safely under concurrent writes.

## Month documents

`/months/{monthId}` uses a canonical `YYYY-MM` document ID and stores:

```text
year
month
month_start
month_end
is_settled
calculation_version
created_at / created_by
updated_at / updated_by
```

`month_start` is the first instant of the month in UTC and `month_end` is the
last millisecond of the month in UTC. A newly initialized month starts with
`is_settled: false` and `calculation_version: 0`.

After a coordinator explicitly selects **Utwórz miesiąc**, the browser may
create this initial canonical document when it is missing. Merely opening the
settlement page or selecting a month performs no write. Calculation state,
later calculation versions, and settlement state remain server-owned.

## Current status and payroll-period participation

`employees.is_active` represents the employee's current HR status for
day-to-day coordination. It may be used by current-workforce views and
workflows, but it is not historical evidence that the employee did or did not
participate in an earlier payroll month.

Monthly participation is determined only by overlap between the employment
period and the selected payroll month:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

For example, an employee whose employment ended on 15 June is inactive in
July, but must still be included when June payroll is calculated in July.

Future month initialization and payroll calculation must not filter employees
by their current `is_active` value. If `employment_start` is missing, the
future monthly workflow must surface the incomplete employment data for
resolution rather than using current status as a fallback.

## Virtual daily defaults

An empty working day does not create a daily-value document. The future UI renders the appropriate default, and recalculation applies the same rule in memory.

A daily-value document exists only for an explicit fact such as a manual edit or applied attendance import. An absence remains governed by its absence document rather than a duplicate daily-value fact.

The settlement shell displays virtual `8h` for a non-future working day and
virtual `0h` for a non-future weekend or configured public holiday when the day
falls inside the employee's employment period and has no persisted daily
value. Future days and dates outside employment remain empty. Displaying these
defaults never creates a Firestore document.

Manual daily-value edits use the canonical document ID
`{employeeId}_{YYYY-MM-DD}`, source `manual`, and modification metadata. A
manual value may be updated or deleted while the month is open. Clearing it, or
returning it to the applicable virtual default, deletes the manual document so
the virtual value becomes visible again. Imported daily values remain
client-read-only.

Daily values are worked-hour facts only. They do not define nominal month
hours, employee-specific nominal hours, bonuses, absence calculations, or
payroll results. Those concepts remain deferred until an approved Business
Rules Specification exists.

## Settlement lock

The month document carries `is_settled`. Client writes beneath a settled month are denied by Firestore rules. Admin SDK operations bypass rules and must independently enforce the same invariant in future Cloud Functions.

## Ownership boundaries

- `employeeSettlements` are server-calculated snapshots and are client
  read-only.
- `dailyValues` store only explicit manual or applied attendance facts. The
  client may write only manual facts.
- `absences` are the sole source of truth for absence facts. Absence fields are
  not accepted in daily-value documents.
- import processing state, calculation state, settlement state, and report
  output are server-owned.
- `auditLog` accepts authenticated append operations tied to the caller UID;
  updates and deletes are denied.
