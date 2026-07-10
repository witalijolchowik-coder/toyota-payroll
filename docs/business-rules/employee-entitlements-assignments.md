# Employee Entitlements & Assignments

This document defines employee-level facts used by `Rozliczenie miesięczne`.
They are explicit coordinator-maintained records. They must not be inferred from
department, shift, employee name or any unrelated field.

## Concepts

### UDT entitlement

- UDT allowance is a brutto component.
- Default business amount is 300 PLN, with the amount resolved through payroll
  settings when configured.
- UDT is paid only when:
  - the employee has an active UDT entitlement covering the full calendar month;
  - the employee's employment covers the full calendar month.
- Partial UDT entitlement or partial employment in the month gives 0 PLN.
- Absences, holidays, NN and worked-hour quantities do not reduce UDT.

### Own housing allowance

- Own housing allowance is a brutto component for an employee's own
  accommodation.
- It is not company accommodation.
- It is paid only when:
  - the employee has an active own-housing entitlement covering the full
    calendar month;
  - the employee's employment covers the full calendar month;
  - an effective payroll setting exists for `own_housing_allowance`.
- No proportional own-housing allowance is paid for a partial month.

### Company accommodation assignment

- Company accommodation is a deduction/payment for living in company
  accommodation.
- Toyota payroll uses UoP rules for this project. The older UZ 1–15 / 16–31
  rule must not be used.
- The deduction is proportional by calendar days of assignment validity in the
  selected month.
- Absences, L4, vacation, NN and actual worked days do not reduce it.
- The assignment must specify an accommodation variant. The rent amount is
  resolved from payroll settings using `accommodation_allowance` and the variant
  key.
- Media/utilities are resolved from `company_housing_media`.
- If a required variant/setting is missing, the component remains unresolved and
  the settlement shows a warning instead of silently using a fake amount.

## Effective dating and history

Entitlements and assignments are effective-dated:

- `valid_from` is required.
- `valid_to` is optional.
- `status` is either `ACTIVE` or `CANCELLED`.
- Hard deletes are not allowed.

The same employee may have different entitlement states across time. Monthly
Settlement resolves the selected month from the validity period and employee
employment dates.

## Employee identity

Entitlement documents store:

- `employee_id` as the internal Firestore employee reference;
- `teta_number` as the primary business identifier.

Employee names are not duplicated in entitlement documents.

## Mutual exclusivity

Own housing allowance and company accommodation should not overlap for the same
employee. In the MVP, the browser blocks this overlap during coordinator entry,
and the reusable pure helper emits a warning if overlapping historical data is
encountered. Future server-side hardening can enforce this in Cloud Functions if
needed.

## Monthly Settlement resolution

For each employee in a payroll month:

1. Load active employee entitlements/assignments.
2. Resolve UDT and own-housing allowance only when the entitlement covers the
   full month.
3. Resolve company accommodation when the assignment overlaps the month.
4. Calculate company accommodation proportionally by calendar-day overlap.
5. Surface warnings for housing conflicts and missing accommodation
   variant/settings.

## Current limitations

- No ZUS, PIT, net salary or full payroll calculation is introduced here.
- No payroll closing or immutable final settlement snapshot is introduced here.
- Because entitlement documents are global effective-dated records, Firestore
  rules cannot fully know whether a future edit affects a historically settled
  month. The historical correctness strategy is:
  - preserve effective dates and cancellation history;
  - forbid hard deletes;
  - later payroll closing must freeze the resolved month snapshot or block
    retroactive changes that affect settled months.
