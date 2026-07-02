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
```

No business collections are created during Step 1.

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
