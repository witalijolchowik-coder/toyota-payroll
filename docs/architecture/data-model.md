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

## Virtual daily defaults

An empty working day does not create a daily-value document. The future UI renders the appropriate default, and recalculation applies the same rule in memory.

A daily-value document exists only for an explicit fact such as a manual edit or applied attendance import. An absence remains governed by its absence document rather than a duplicate daily-value fact.

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
