# ADR 0015: Monthly settlement components remain a read-only aggregation

## Status

Accepted.

## Context

Block 9 introduces practical coordinator-facing monthly settlement components.
The app is not intended to become a full payroll/accounting system and must not
calculate ZUS, PIT, taxes, net salary, employer cost or final payslips.

The existing architecture already has source documents for employees, daily
values, absences, payroll settings and monthly adjustments. Persisting another
authoritative settlement document at this stage would duplicate source facts
before payroll closing rules are approved.

## Decision

Extend the existing monthly calculation draft with settlement components:

- hours-only work-time and absence quantities;
- brutto monetary components;
- the separate netto transport allowance;
- deductions;
- manual active adjustments;
- warnings and limitations.

The result is calculated in pure TypeScript and displayed read-only in
`Rozliczenie miesięczne`. No final settlement snapshot is written to Firestore
in this block.

UDT, own housing allowance and company accommodation are represented by a safe
optional entitlement/assignment input. Because the current employee model does
not yet store those facts, the production UI does not infer them from
department or shift.

## Consequences

- Existing source-of-truth documents remain unchanged.
- Firestore rules do not need to change.
- Future payroll closing can persist a reviewed snapshot later without
  rewriting the source aggregation.
- Brutto, netto and deduction totals stay separate, avoiding a misleading
  "net salary" result.
