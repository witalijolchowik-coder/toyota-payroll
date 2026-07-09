# ADR 0012: Calendar Constructor reuses attendance and absence documents

## Status

Accepted

## Context

Coordinators need a visual way to plan and correct a payroll month. The system
already has source-of-truth documents for worked-hour facts and absences. A
separate calendar status document would duplicate those facts and risk
divergence.

## Decision

- Implement the Calendar Constructor as a UI layer over existing `DailyValue`
  and `Absence` documents.
- Keep one continuous range selection for one employee in this foundation
  stage.
- Use existing services for writes:
  - manual daily value create/update;
  - imported `manual_override` update;
  - manual attendance clear;
  - absence create with existing absence semantics.
- Keep settled months read-only.
- Add an employee-focused calendar dialog for review and detailed daily-hour
  editing.
- Do not introduce a new calendar status collection.

## Consequences

The constructor remains aligned with payroll source documents and security
rules. It can support real coordinator work without creating another state
machine. Multi-row painting, department/shift filters, and richer absence
editing remain future enhancements.
