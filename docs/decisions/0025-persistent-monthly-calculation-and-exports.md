# ADR 0025: Persistent monthly calculation, locking and operational exports

## Status

Accepted.

## Context

The previous monthly calculation was a browser-only draft and the previous
exports were reduced technical files. The supplied June 2026 Toyota workbook
and both SOZ CSV files are now the binding structural references.

## Decision

- Reuse the existing payroll, schedule, absence, entitlement and adjustment
  helpers. Do not introduce a parallel payroll classifier.
- Treat the generated employee schedule as the default actual work. BHP is an
  eight-hour first-shift working day.
- Persist one versioned calculation snapshot per employee under
  `months/{monthId}/employeeSettlements/{employeeId}`. A transaction-owned run
  identifier prevents an older run from overwriting a newer run.
- Store calculation status, input hash, counts and version on the month. A
  stable input hash prevents result writes from starting another identical
  calculation.
- A month can be locked only after a completed calculation without blockers.
  Unlocking is explicit, clears calculation currency and queues recalculation.
- Confirmed zero, missing input and a failed source read are distinct. Failed
  optional reads create a calculation blocker instead of becoming a healthy
  empty collection.
- The client workbook is a real `.xlsx`, one `Godziny` sheet and the exact
  43-column reference order. SOZ retains its exact 138 columns, UTF-8 BOM,
  semicolon delimiter, CRLF and Polish decimal comma.
- SOZ citizenship split uses stored citizenship: `PL` is Polish and every
  other known citizenship is foreign. Missing citizenship is an export blocker.
- Client overtime is net of shortage compensation; SOZ preserves raw 50% and
  100% hours. Conditional Polish and foreign compensation workbooks explain
  the allocation.
- A manual `Zgłoszone` L4 occupies the day and suppresses virtual work, but it
  remains unconfirmed and blocks completion until reconciled with ZUS.
- WZN may point to the concrete worked date whose 100% hours compensate it.
  Linked 100% hours are reserved before the normal 50%-then-100% shortage
  allocation; a missing or insufficient link is a blocker.
- Keep at most three changed month recovery points. Automatic points are
  approximately two hours apart; an explicit point may be requested by the
  coordinator. Restoration is one atomic batch and queues a fresh calculation.

## Safety boundaries

- No proportional base salary, hourly wage, statutory payroll, tax, ZUS or net
  salary is calculated.
- Imported L4 remains an external source-of-truth and is never rewritten by
  calculation.
- Recovery never rolls confirmed imported L4 back over a newer ZUS event.
  Imported attendance facts are also preserved; only their coordinator-owned
  override/correction layer is recoverable. A locked month must be explicitly
  unlocked before restoration.
- The operational MVP limits one atomic recovery restore to 450 writes, below
  the Firestore batch limit. An oversized snapshot is rejected before any
  restore write rather than being partially applied.
- Manual adjustments remain separate source records and survive recalculation.
- Firestore rules permit only the exact calculated snapshot shape and preserve
  settled-month child write protection.
