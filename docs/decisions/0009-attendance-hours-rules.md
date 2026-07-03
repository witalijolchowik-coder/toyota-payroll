# ADR 0009: Attendance facts and imported-value overrides

- Status: Accepted
- Date: 2026-07-03

## Context

Attendance imports and coordinator corrections must coexist without losing the
source fact or creating duplicate effective employee-day records.

## Decision

- Retain one canonical `DailyValue` document per employee-day.
- Keep imported `hours`, source, import linkage, identity, and metadata
  immutable to browser clients.
- Store an optional audited `manual_override` in an imported document.
- Resolve effective hours as `manual_override.hours ?? hours`.
- Clear only the override to restore the imported value.
- Keep standalone manual facts as source `manual`; clearing them deletes the
  manual document and restores the governing fallback.
- Surface absence conflicts, non-working-day facts, and outside-employment
  facts as warnings without calculating a payroll consequence.

## Consequences

The original import remains available for traceability, the coordinator can
correct the effective visible value, and one employee-day still has one
effective document. Firestore Rules permit only narrowly scoped override
updates and continue denying browser creation or mutation of imported base
facts.
