# ADR 0006: Payroll-period participation

- Status: Accepted
- Date: 2026-07-02

## Context

Payroll is commonly calculated at the beginning of one month for the preceding
month. An employee can therefore be inactive today while still belonging to
the payroll population for the selected historical period.

Using the current HR status would incorrectly exclude employees whose
employment ended during or after the selected month.

## Decision

Keep two concepts separate:

1. `employees.is_active` is the current HR status used for day-to-day
   coordination.
2. Payroll-period participation is a historical date-overlap decision.

An employee participates in a payroll month exactly when:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

Month initialization, settlement views, recalculation, imports, and reports
must use this overlap rule whenever they determine the employee population for
a selected month. They must not use `is_active` for that decision.

The Employees module may continue to display and filter the current status.
This ADR does not introduce payroll calculation code.

## Incomplete dates

The current MVP employee schema permits a missing `employment_start`. A future
monthly workflow must treat that as incomplete employment data and present it
for resolution. It must not infer monthly participation from `is_active`.

## Consequences

- Employees who left during a month remain included in that month's payroll.
- A later deactivation does not rewrite historical participation.
- Current workforce coordination can remain focused on active employees
  without changing payroll results for earlier periods.
