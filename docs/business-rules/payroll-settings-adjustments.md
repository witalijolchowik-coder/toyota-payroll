# Payroll settings and employee adjustments

- Specification block: 4
- Status: Approved
- Scope: global effective-dated payroll settings, frequency-bonus rules, and
  coordinator-entered monthly employee adjustments

## Global payroll settings

Payroll settings are global configuration, not employee facts. Each document
is an append-only version stored in `/payrollSettings`.

```text
setting_key
variant_key
variant_name
amount
valid_from
valid_to
active
description
created_at / created_by
updated_at / updated_by
```

`valid_from` and `valid_to` use canonical payroll month IDs (`YYYY-MM`).
`valid_to` is inclusive and may be `null`. The effective resolver selects the
active matching version with the latest `valid_from` that covers the selected
payroll month. This permits a new open-ended version to supersede an older
open-ended version without mutating the older record.

Two active versions for the same setting identity and the same `valid_from`
are invalid. The service also rejects a new version whose `valid_from` falls
in or before the latest settled month. Existing versions are never edited or
deleted by the browser.

The initial known setting keys are:

- `frequency_bonus`;
- `transport_allowance`;
- `accommodation_allowance`;
- `udt_allowance`.

Setting keys remain strings so future global settings do not require a schema
redesign.

## Accommodation types

Accommodation variants use the same versioned setting collection:

```text
setting_key: accommodation_allowance
variant_key: stable technical type key
variant_name: coordinator-facing name
```

Every accommodation type has independent amount and validity versions.
Employee-to-accommodation assignment is outside this block.

## Frequency bonus

The reusable frequency-bonus helper applies these rules:

- the employee must be employed for the entire calendar month;
- partial-month employment produces `0 PLN`;
- approved absences do not reduce the bonus;
- any ACTIVE `NN` record overlapping the month produces `0 PLN`;
- distinct ACTIVE L4 source records overlapping the month are counted once.

The amount schedule is:

| L4 records | Amount  |
| ---------- | ------- |
| 0          | 400 PLN |
| 1          | 350 PLN |
| 2          | 300 PLN |
| 3          | 200 PLN |
| 4 or more  | 0 PLN   |

The helper returns the amount, L4 count, NN flag, and decision reason. It does
not aggregate payroll or write calculation results.

## Employee adjustments

Employee adjustments are explicit monthly facts stored under:

```text
/months/{monthId}/adjustments/{adjustmentId}
```

Each adjustment contains the standard employee reference and audit metadata,
plus:

```text
category: MANUAL_BONUS | MANUAL_DEDUCTION | OTHER
direction: INCREASE | DECREASE
amount
note
status: ACTIVE | CANCELLED
```

`MANUAL_BONUS` always increases and `MANUAL_DEDUCTION` always decreases.
`OTHER` supports either direction. Amounts must be finite and non-negative.
Zero is valid because the approved rule prohibits negative values but does not
require a positive minimum.

An ACTIVE adjustment may be edited while its month is open. Cancellation
changes only lifecycle status and audit metadata. Deletion is denied.
Cancelled adjustments and all adjustments in settled months are read-only.

## Historical correctness

- Payroll setting versions are append-only.
- New versions cannot start in settled history through the client service.
- Monthly adjustment writes require an existing open month.
- Settled month rules deny adjustment creation, editing, cancellation, and
  deletion.

The browser preflight that protects settings from starting in settled history
cannot be made fully race-proof with Firestore Rules alone. A future
server-authoritative administration boundary should repeat this invariant.

## Deferred work

This block does not implement payroll aggregation, salary calculation,
transport calculation, accommodation deductions, UDT calculation, employee
accommodation assignment, reports, or imports.
