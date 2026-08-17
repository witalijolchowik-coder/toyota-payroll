# Employee Entitlements & Assignments

This document defines employee-level facts used by `Rozliczenie miesięczne`.
UDT remains an explicit coordinator-maintained entitlement. Housing is resolved
from the employment lifecycle and company-accommodation history managed through
the house icon in `Pracownicy`.

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
- Own housing is the default while an employment lifecycle is active and no
  company-accommodation record covers the day.
- It is paid only when:
  - the employee's employment covers the full calendar month;
  - no company-accommodation record covers any day of the month;
  - an effective payroll setting exists for `own_housing_allowance`.
- No proportional own-housing allowance is paid for a partial month.
- No manual own-housing entitlement is required or created by the normal
  workflow. Legacy records remain readable for diagnostics.

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

UDT entitlements and company-accommodation assignments are effective-dated:

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

Two company-accommodation periods must not overlap for the same employee.
Legacy own-housing records that overlap company accommodation are retained but
reported as diagnostics; they are not required to establish own-housing status.

## Coordinator housing workflow

Housing is changed through one effective-dated transition operation:

- moving into company accommodation opens a company-accommodation period on the
  selected first day;
- moving out closes company accommodation on the day preceding the selected
  first day outside company housing;
- own-housing periods are derived from employment lifecycle gaps between
  company-accommodation periods and are not stored as synthetic records;
- a direct transfer between company accommodation objects remains one deposit
  episode when there is no day gap;
- a real gap followed by a new company-accommodation period creates a new
  deposit episode.

The operation is atomic and audited. It is rejected when the resulting
effective-dated change would alter a settled month. No hidden production data
migration or destructive cleanup is performed.

## Monthly Settlement resolution

For each employee in a payroll month:

1. Load active employee entitlements/assignments.
2. Resolve UDT from its entitlement and own housing automatically from full-month
   employment with no company-accommodation day.
3. Resolve company accommodation when the assignment overlaps the month.
4. Calculate company accommodation proportionally by calendar-day overlap.
5. Surface warnings for housing conflicts and missing accommodation
   variant/settings.
6. Classify partial housing coverage as a transition month; do not pay a
   proportional own-housing allowance.

## Current limitations

- No ZUS, PIT, net salary or full payroll calculation is introduced here.
- No payroll closing or immutable final settlement snapshot is introduced here.
- The service checks affected settled months before changing effective-dated
  housing history. A final immutable payroll snapshot remains Stage 4 work.
