# Employee readiness, allowances and accommodation

This specification defines the employee data gate used before a payroll month can be finalized. It extends the existing employee, entitlement, payroll-setting and audit collections; it does not add a parallel data model.

## Employment and current status

- Payroll participation uses the union of non-cancelled contract days that
  overlap the selected month. `is_active` never determines historical
  participation.
- The employee list derives the current contract from contract history.
  Contract expiry alone creates a decision-required state; only explicit
  employment ending moves the employee to the archive after the final day.
- TETA may be temporarily empty while a coordinator prepares the register, but it blocks month finalization and export readiness.
- Department is mandatory for readiness and must be one of the canonical departments. Shift/color assignment remains optional; an unresolved generated schedule day blocks finalization.

## Identity and salary basis

- Citizenship is `PL`, `UA`, or `OTHER`.
- A Polish employee requires PESEL. A foreign employee requires PESEL and passport number.
- `first_toyota_employment_date` is the stable first Toyota employment date. Re-employment must not replace an existing value.
- Base salary by first Toyota employment date is: through 2025-09-30: 5,464; 2025-10-01 through 2026-03-31: 5,279; from 2026-04-01: 5,160.

## Allowances

- Laundry allowance is capped at 40 and transport allowance at 275. Both are proportional to qualifying attendance days in the employee's nominal working days.
- Qualifying presence is work, BHP, training, or delegation. Absence, NN, and days off do not qualify.
- Frequency bonus is capped at 400 and follows the existing frequency-bonus rules; NN removes eligibility.
- Own-housing allowance is 300 for an effective full-month entitlement. UDT is 300 and uses its effective-dated entitlement.

## Company accommodation

- Accommodation is assigned through the existing effective-dated `COMPANY_ACCOMMODATION` entitlement.
- The move-in date is the first chargeable day. The move-out date entered by the coordinator is the first day outside the accommodation; the stored entitlement ends on the preceding day.
- Category rates are effective-dated payroll-setting versions. Each category has an accommodation/rent amount and a media amount. Category A defaults to 500 plus 150 media.
- The monthly charge is proportional to the overlap of the payroll month, employment period, and accommodation period.
- Company accommodation and own-housing allowance must not overlap silently.

## Readiness levels and exports

The readiness panel exposes three levels: data preparation possible, draft calculation possible, and finalization allowed. Missing TETA, employment start, required identity documents, first Toyota employment date, department, schedule resolution, mandatory allowance settings, accommodation rates, or confirmed L4 state blocks finalization.

A draft export remains available. If readiness warnings exist, its file name begins with `ROZLICZENIE_NIEZAMKNIETE_` and the UI identifies it as an unfinished version. This file is not a final payroll export.

## Bulk updates and audit

- Bulk employee updates are partial: each selected row reports updated, skipped, blocked, or failed, and processing progress is visible.
- Repeating the same update must be safe; unchanged rows are skipped.
- Employee changes, entitlement changes, payroll-setting versions, and bulk-update summaries append an audit entry using the existing `auditLog` boundary.
