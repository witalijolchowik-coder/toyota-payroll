# Versioned payroll settings and refundable housing deposit

- Status: implemented foundation
- Scope: safe configuration lifecycle, tax classification, settlement
  component provenance, and company-housing deposit

## Version lifecycle

Every monetary setting has an inclusive `valid_from` / `valid_to` month range.
`valid_to` may be `null`. For one `(setting_key, variant_key)` identity, no
two non-cancelled versions may cover the same month.

Creating a version inside one older open range is an atomic split: the older
version ends in the preceding month and the new version is created. The UI
shows this impact and requires confirmation. A proposal touching more than one
existing range is blocked for explicit correction instead of being resolved
by arbitrary ordering.

Versions are `Przyszła`, `Aktywna`, `Historyczna`, or `Anulowana`. There is no
physical deletion. An active version may be ended; a future unused version may
be cancelled. Changes reaching settled history are rejected. Every lifecycle
change is audited.

## Amount and tax classification

`amount` is the configured value and `tax_type` is `GROSS` or `NET`. The
coordinator-facing labels are `Kwota (PLN)` and `Podatek`. No gross/net
conversion is performed.

Legacy transport versions without the field resolve as `NET`; legacy housing
deposit versions resolve as `NET`; other legacy versions resolve as `GROSS`.
The value itself is never changed by this compatibility mapping.

The known configuration includes frequency bonus, transport, UDT, holiday
work, laundry, own housing, company accommodation/media, and refundable
housing deposit. Once data is migrated, a missing effective version is a
calculation blocker. It is not silently replaced by a source-code constant.

## Settlement component source of truth

The canonical effective-version resolver feeds monthly calculation, review
details, blockers, persisted calculation results, and exports. Employee
details separately show attendance bonus, laundry, transport, UDT, holiday
work, own housing, accommodation, media, deposit withholding/return, and
manual adjustments. Compact list totals remain an aggregate of those same
components.

## Refundable company-housing deposit

The setting key is `housing_deposit`, initially intended as `99 PLN NET`.
Company-accommodation assignments that touch or follow one another without a
day gap form one continuous episode, even when the housing object changes.

- move-in month: withhold once;
- continuous middle months: keep held, with no new withholding;
- move-out month: return once;
- employment ending during an episode: return in the final employment month;
- a later episode after a real gap: withhold a new deposit.

The episode identity makes recalculation idempotent. A coordinator may reduce
the return to a value from zero through the held amount and record a reason.
The override is stored with the employee-month review state, audited, preserved
by recalculation, and protected by settled-month rules.

Unknown configuration remains distinguishable from a legitimate zero through
calculation blockers and warnings.
