# MVP data model

This is the final MVP shape. It supersedes the earlier enterprise collection hierarchy as the immediate build target.

## Collections

```text
/payrollSettings/{settingVersionId}

/departments/{departmentId}

/employees/{employeeId}

/employeeEntitlements/{entitlementId}

/months/{monthId}
  /employeeSettlements/{employeeId}
  /reviewStates/{employeeId}
  /dailyValues/{employeeId_YYYY-MM-DD}
  /absences/{absenceId}
  /adjustments/{adjustmentId}
  /imports/{importId}

/reports/{reportId}
/auditLog/{entryId}
```

The paths are prepared in code and Security Rules; the foundation creates no
production documents.

## Payroll setting versions

`/payrollSettings` stores append-only global amount versions. Validity uses
inclusive canonical month IDs (`valid_from`, `valid_to`) so future payroll
work can resolve configuration for a selected month without changing earlier
versions. Accommodation types use `variant_key` and `variant_name`; other
settings leave both fields null.

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

## Departments and employee color shifts

Departments are editable reference documents under `/departments`. Employee
documents store stable `department_id` and optional `shift_assignment`
(`RED`, `WHITE`, `BLUE`, or `null`).

These fields describe current coordination context. They do not decide
payroll-month participation and they are not duplicated into operational
attendance, absence, adjustment, import or settlement documents.

## Employee entitlements and assignments

`/employeeEntitlements` stores explicit employee-level facts used by Monthly
Settlement. It covers:

- UDT entitlement;
- own housing allowance entitlement;
- company accommodation assignment and accommodation variant.

Documents are effective-dated with `valid_from`, optional `valid_to`, and
`ACTIVE`/`CANCELLED` lifecycle status. They store only `employee_id` and
`teta_number`; employee names are resolved from `/employees`.

Monthly Settlement resolves these documents for the selected month in memory.
UDT and own housing require full-month entitlement and full-month employment.
Company accommodation is calculated by calendar-day overlap with the selected
month. Hard deletes are denied. Because these documents are global
effective-dated records, future payroll closing must freeze resolved snapshots
or block retroactive edits that would affect settled months.

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
the virtual value becomes visible again.

Imported daily values remain read-only at the base-fact level. An imported
document may contain an optional audited `manual_override` map with `hours`,
`note`, `actor_uid`, and `updated_at`. Effective hours are
`manual_override.hours ?? hours`. The browser may add, change, or clear only
this override in an open month; imported hours, source, import linkage,
identity, and base creation metadata remain preserved.

Daily values may also contain an optional coordinator-owned
`work_time_correction` map with the planned actual working shift interval and
the corrected actual start/end time. This field coexists with `hours` and
`manual_override`; it does not replace imported base facts. Derived private
time, overtime 50%, overtime 100%, coverable NI, and monthly balancing remain
calculated in memory until a later payroll-closing stage persists authoritative
results. Detailed `classification_override` data is reserved for a later
server-side/admin workflow; browser writes keep it `null`.

Daily values are worked-hour facts only. They do not define nominal month
hours, employee-specific nominal hours, bonuses, absence calculations, or
payroll results. Those concepts remain deferred until an approved Business
Rules Specification exists.

## Settlement lock

The month document carries `is_settled`. Client writes beneath a settled month are denied by Firestore rules. Admin SDK operations bypass rules and must independently enforce the same invariant in future Cloud Functions.

## Monthly review state

`/months/{monthId}/reviewStates/{employeeId}` stores coordinator workflow state
for the employee-month review. It uses the employee ID as the document ID and
stores `employee_id`, `teta_number`, `month_id`, `review_status`,
`review_note`, `reviewed_at`, `reviewed_by`, and modification metadata.

Review state does not store calculated payroll results and does not freeze
source data. It is blocked by the same settled-month read-only rule as other
month-owned coordinator documents. Review readiness is an informational signal
for future export/closing work only.

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
- global payroll setting versions are client-create-only and cannot be updated
  or deleted;
- monthly adjustments use ACTIVE/CANCELLED lifecycle and cannot be deleted.

## Absence ownership and lifecycle

An absence is stored once under the month containing its `start_date`:

```text
/months/{startDate YYYY-MM}/absences/{absenceId}
```

Cross-month reads use the `absences` collection group and include a document
whenever its inclusive date range overlaps the displayed month. Operational
documents continue to store only `employee_id` and `teta_number`; employee
names are resolved from `/employees`.

Absence lifecycle status is `ACTIVE` or `CANCELLED`. Client deletion is denied.
Manual ACTIVE records may be edited or cancelled while their owning month is
open. Imported records and records owned by settled months remain read-only.
