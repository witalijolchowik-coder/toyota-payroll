# ADR 0011: In-memory monthly payroll calculation draft

## Status

Accepted

## Context

The project needs a payroll-engine foundation that can combine employees,
employment periods, calendar rules, attendance facts, absences, payroll
settings, frequency bonus rules, and monthly adjustments.

The final payroll report, month closing workflow, export formats, and
server-authoritative recalculation boundaries are not specified yet.

## Decision

- Implement the first engine layer as pure TypeScript calculation helpers.
- Produce an employee-month draft with identities, attendance breakdown,
  absence grouping, frequency bonus result, adjustments, warnings, and safe
  preliminary totals.
- Display the draft in the Monthly Settlement workspace as read-only
  verification data.
- Do not persist calculation drafts in Firestore in this block.
- Do not introduce a new collection, Cloud Function, report, export, or final
  payroll snapshot.

## Consequences

The calculation layer is testable and reusable by future payroll stages without
making draft data authoritative. The existing Firestore security rules remain
unchanged because no new persisted document type is introduced.

Future implementation can choose whether to persist drafts, calculated
snapshots, or final reports once closing and recalculation authority are
specified.
