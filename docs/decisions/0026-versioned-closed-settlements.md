# ADR 0026: Versioned closed settlements and immutable export artifacts

## Status

Accepted.

## Context

A settled flag protects writes, but it does not make a historical payroll
reproducible when the calculation or export generator changes later.

## Decision

- The user-facing lifecycle remains `OTWARTE` or `ZAMKNIĘTE`.
- Closing creates an append-only `settlementVersions/{versionId}` document,
  one final calculation result per employee and the exact generated payroll
  artifacts for that version.
- Artifact bytes are split into bounded Firestore chunk documents. Downloads
  from a closed month reassemble those bytes; they never invoke the current
  generator.
- A closed month reads employee calculation results from its current version.
  It does not run the current calculation algorithm for the final view.
- Reopening requires a reason in the existing audit log. It keeps the current
  version in history, returns the month to editable state and queues a fresh
  calculation. The next close creates the next version.
- Calculation and export readiness distinguish `BLOCKER` from `WARNING`.
  Blockers prevent close; warnings remain visible and may be accepted.
- Open-month exports are dynamic previews and retain the
  `ROZLICZENIE_NIEZAMKNIETE` marker.

## Safety boundaries

- One close is an atomic Firestore transaction. It is rejected before writing
  when the snapshot would exceed the conservative 480-write limit.
- Closed version, calculation and artifact documents are immutable and cannot
  be deleted through client rules.
- Legacy closed months without a version are not recalculated silently. They
  must be explicitly reopened, verified and closed to create a first durable
  version.
