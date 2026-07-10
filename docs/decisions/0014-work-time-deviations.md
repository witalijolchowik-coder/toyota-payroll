# ADR 0014: Work-time deviations extend DailyValue

## Status

Accepted.

## Context

Block 8 introduces payroll meaning based on planned work time compared with
actual coordinator-corrected work time. The existing architecture already has
one canonical `DailyValue` document per employee-day and imported values can be
corrected without overwriting the imported base fact.

Adding another attendance collection would create duplicate employee-day facts
and weaken the one-source-per-day boundary.

## Decision

Extend `DailyValue` with an optional `work_time_correction` map:

```text
planned_shift
planned_start_time
planned_end_time
actual_start_time
actual_end_time
classification_override
```

The field is coordinator-owned and may exist on manual or imported daily-value
documents. Imported `hours`, `source`, `import_id`, identity and base metadata
remain protected.

For the current browser/client scope, `classification_override` is reserved and
must remain `null`; coordinators store planned/actual time intervals only.
Detailed classification overrides require later server-side/admin hardening.

Derived payroll meaning is calculated in pure TypeScript helpers. No
authoritative payroll result is persisted in this block.

## Consequences

- Existing manual and imported daily-value behavior is preserved.
- The system can explain private time and overtime from planned-vs-actual time
  without making `DailyValue.hours` the only payroll semantic source.
- Firestore rules can still protect settled months and imported base fields.
- Future import, schedule and payroll-engine work can reuse the same
  employee-day document instead of reconciling parallel records.
