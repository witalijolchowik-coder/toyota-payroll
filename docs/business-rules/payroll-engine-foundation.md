# Payroll engine foundation

- Specification block: 5
- Status: Approved for foundation implementation
- Scope: monthly calculation draft for verification and future payroll engine

This block introduces a reusable calculation layer that can produce a
structured employee-month draft. The draft is not a final payroll result, not a
closed settlement, and not a report export.

## Inputs

The draft consumes already approved foundations:

- employee identity and employment dates;
- payroll month calendar and individual nominal hours;
- explicit daily attendance values and manual overrides;
- active absences, including cross-month records supplied by the caller;
- versioned payroll settings;
- frequency-bonus helper;
- monthly employee adjustments.

The draft keeps `employee_id` and `teta_number` as identifiers. It does not
duplicate employee names in operational payroll output.

## Participation and employment

Payroll participation continues to use employment-period overlap:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

Current `is_active` status is not used for historical month membership.

When `employment_start` is missing or the period does not overlap the month,
the draft marks the employee as not participating and emits a warning.

## Attendance

Explicit attendance uses the existing effective-value rule:

```text
manual_override.hours ?? hours
```

The draft separates:

- manual hours;
- imported hours;
- imported hours corrected by manual override;
- virtual default hours.

Virtual `8h` is used only for calculation fallback on working dates inside the
employment period when no explicit attendance fact and no governing absence
exists. It is still not persisted.

Explicit values outside the employment period produce a warning and are not
counted as normal worked hours.

Explicit hours on non-working days are counted as explicit worked hours and
flagged for review. Their overtime or holiday-work consequence remains
deferred.

If active absence and explicit hours overlap, both facts remain visible in the
draft and a conflict warning is emitted. This block does not invent a final
financial consequence for the conflict.

## Absences

Only ACTIVE absences are evaluated. CANCELLED absences are ignored.

Absence ranges are evaluated only inside the selected month and inside the
employee employment period. L4 keeps the priority already defined in the
absence rules. Ambiguous non-L4 combinations produce a warning.

The draft groups absence days and nominal absence hours by code. At foundation
level, absence hours are safe only as nominal working-day hours; final absence
pay consequences remain deferred.

The draft exposes at least:

- L4 hours;
- NN hours;
- approved/justified absence hours.

## Frequency bonus

The draft reuses the approved frequency-bonus helper:

- full-month employment is required;
- active NN zeros the bonus;
- distinct active L4 records are counted once;
- approved absences do not reduce the bonus.

The draft also resolves the effective `frequency_bonus` payroll setting for
the month. If the setting is missing, the bonus amount is marked unresolved and
a warning is emitted.

The existing approved L4 amount schedule remains the current amount source
until a later specification defines a dynamic schedule model.

## Adjustments

Only ACTIVE monthly employee adjustments are included.

The draft separates:

- increases;
- decreases;
- adjustment breakdown entries.

CANCELLED adjustments are ignored.

## Totals

The draft prepares only safe totals:

- worked hours total;
- nominal hours;
- virtual hours;
- frequency bonus amount when resolved;
- manual increases;
- manual decreases;
- preliminary additions and deductions from implemented parts only.

It does not calculate final salary, net salary, tax, ZUS, overtime, transport,
accommodation, UDT, exports, reports, or month closing.

## Persistence

Calculation drafts are computed in memory. They are not persisted to Firestore
in this block. This avoids treating draft data as authoritative payroll output
before closing, reporting, and server-authoritative recalculation rules are
specified.

Future persistence, if required, should be introduced with a separate decision
record and must preserve settled-month read-only guarantees.

## Implementation mapping

The foundation is implemented as pure TypeScript helpers under
`src/utils/payroll/calculationDraft.ts` and is displayed as a read-only
verification panel in the Monthly Settlement workspace.

The UI labels the result as a working draft and must not present it as a final
payroll report.
