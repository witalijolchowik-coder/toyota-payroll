# Monthly settlement components - Block 9

- Specification block: 9
- Status: Approved
- Scope: read-only monthly coordinator settlement aggregation
- Implementation status: foundation implemented; final payroll/accounting is not implemented

## System scope

Toyota Payroll prepares `Rozliczenie miesięczne` for coordinator review. It is
not a full payroll/accounting system.

The system does not calculate:

- ZUS;
- PIT;
- taxes;
- net salary;
- employer cost;
- final payslip;
- complete accounting payroll.

The monthly settlement view must not multiply normal or overtime hours by an
employee hourly rate. Work-time settlement is shown as quantities such as
nominal hours, worked hours, L4 hours, vacation hours, `nadgodziny 50%`,
`nadgodziny 100%`, private time and `niedoczas`.

## Settlement result model

The current implementation produces a read-only draft aggregation in memory. It
does not persist an authoritative final settlement snapshot.

Each employee draft contains:

- identity and context: employee ID, TETA, department, shift, employment
  period and participation status;
- work-time quantities;
- absence groups and absence periods;
- monetary coordinator components;
- manual active adjustments;
- warnings and unresolved review items.

## Work-time quantities

The settlement keeps hours as quantities:

- monthly nominal hours;
- individual nominal hours;
- worked or fulfilled hours;
- normal work hours;
- private time;
- covered private time;
- uncovered private time / `niedoczas`;
- overtime 50%;
- overtime 100%;
- paid overtime 50% after monthly balancing;
- paid overtime 100% after monthly balancing.

`Nadgodziny 100%` is one combined payroll category. Night overtime, Saturday
work, Sunday work and official public-holiday work are not displayed as
separate monetary categories in this block.

## Absence periods and counted hours

Absence documents remain source records. A continuous absence document remains
one reporting period even if the calendar period includes weekends.

Settlement absence hours count only working days inside:

- the selected payroll month;
- the absence period;
- the employee employment period.

Example: L4 from Friday to Monday is shown as one period Friday-Monday, but
only Friday and Monday count as working absence days when Saturday and Sunday
are non-working days.

## Frequency bonus

Frequency bonus uses the existing helper:

- base amount: 400 PLN brutto;
- full calendar month employment is required;
- partial month gives 0;
- L4 record count reduces the bonus according to the approved schedule;
- any NN/unjustified absence zeroes the bonus;
- paid vacation does not reduce the bonus.

The UI shows the amount and warning state. Existing payroll settings can still
control whether the component is considered configured for a month.

## Holiday work bonus

Official public-holiday work gives one `300 PLN brutto` component for the month
when at least one public-holiday workday exists.

The bonus is not multiplied by the number of holiday workdays. Overtime from
that day still contributes to the combined `nadgodziny 100%` hours bucket.

The amount can be configured with payroll setting key `holiday_work_bonus`.
Manual component override UI is not implemented in this block; coordinator
corrections should currently use adjustments where needed.

## Transport allowance

Transport allowance is `275 PLN netto` by default and is the only net
allowance in the current model.

It is proportional by physically worked days:

```text
transport amount / eligible working days × physically worked days
```

Eligible working days are working days inside the employee employment period.
Absence days such as L4, vacation, NN, NI and other absence types do not count
as physically worked days.

Assumption for this foundation: explicit non-working day work can count as a
physically worked day for the numerator, but the denominator remains working
days inside employment.

The amount can be configured with payroll setting key `transport_allowance`.

## UDT allowance

UDT allowance is `300 PLN brutto` by default.

Rules:

- paid only when the employee is explicitly marked eligible in the future
  entitlement/assignment model;
- full calendar month employment is required;
- partial month gives 0;
- absences do not reduce it;
- no proportional UDT is calculated.

The employee model does not yet store UDT eligibility, so the production UI
currently shows 0 unless a future entitlement source is connected. The amount
can be configured with payroll setting key `udt_allowance`.

## Laundry allowance

Laundry allowance is `40 PLN brutto` by default.

It is proportional by physically worked days:

```text
laundry amount / eligible working days × physically worked days
```

The amount can be configured with payroll setting key `laundry_allowance`.

## Housing

Two concepts are intentionally separate.

### Own housing allowance

Own housing allowance is paid only for a full month. Partial month gives 0.

The employee model does not yet store own-housing eligibility, so the
production UI currently shows 0 unless a future entitlement source is
connected. The amount can be configured with payroll setting key
`own_housing_allowance`.

### Company accommodation deduction

Toyota is `umowa o pracę`; do not use the older UZ 1-15 / 16-31 rule.

Company accommodation deduction is proportional by calendar days of contract
validity in the month. It is independent of L4, vacation, NN and actual worked
days.

Defaults:

- media/utilities: 500 PLN;
- accommodation: 150 PLN.

The media amount can be configured with payroll setting key
`company_housing_media`. Accommodation rent can use the existing
`accommodation_allowance` setting with variants. The employee model does not
yet store company accommodation assignment, so the production UI currently
shows 0 unless a future assignment source is connected.

## Manual adjustments

Only ACTIVE employee adjustments are included. CANCELLED adjustments are
ignored. Increases and decreases remain separated.

## Summary totals

Totals are separated:

- brutto additions;
- netto transport allowance;
- deductions;
- unresolved/not calculated items.

The system must not merge brutto and netto into one misleading net salary
total.

## Current limitations

- No ZUS/PIT/tax/net salary calculation.
- No final immutable settlement snapshot.
- No payroll closing.
- No payslip/PDF/Excel reports.
- No import engine changes.
- No UI for per-component override of holiday bonus, UDT, transport, laundry
  or housing.
- UDT, own housing and company accommodation require a future employee
  entitlement/assignment source before production values can appear.
