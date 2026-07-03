# Project documentation

The attached design history contains several generations of the architecture. These files capture only the final decisions that govern implementation.

## Authoritative documents

- [MVP architecture](architecture/mvp-architecture.md) — product shape, boundaries, and final simplifications
- [Platform](architecture/platform.md) — React, Firebase, GitHub Pages, and logic placement
- [Data model](architecture/data-model.md) — final MVP Firestore paths and amendments
- [Roadmap](roadmap.md) — approved implementation sequence and current status

## Business rules specifications

- [General payroll rules — Block 1](business-rules/general-payroll-rules.md) —
  payroll calendar, nominal hours, employment-period participation, and
  virtual defaults
- [Absence rules — Block 2](business-rules/absence-rules.md) — absence
  identity, lifecycle, priority, ownership, and workspace behavior

Approved business-rules specifications govern payroll semantics. Architecture
documents continue to govern system structure and implementation boundaries.

## Decision records

- [ADR 0001: Bootstrap stack](decisions/0001-bootstrap-stack.md)
- [ADR 0002: Employee identifiers](decisions/0002-employee-identifiers.md)
- [ADR 0003: Application shell structure](decisions/0003-application-shell.md)
- [ADR 0004: Firestore foundation](decisions/0004-firestore-foundation.md)
- [ADR 0005: Employees module](decisions/0005-employees-module.md)
- [ADR 0006: Payroll-period participation](decisions/0006-payroll-period-participation.md)
- [ADR 0007: Month initialization and settlement shell](decisions/0007-month-settlement-shell.md)
- [ADR 0008: Manual daily-value entry](decisions/0008-daily-value-entry.md)

## Authority order

When documents appear to conflict, use this order:

1. MVP Scope Definition v1.0
2. TETA Identifier Amendment
3. Phase 1 Implementation Plan amendments
4. Phase 1 Implementation Plan
5. Technical Platform Baseline v1.0
6. Earlier locked enterprise architecture as future-reference material only

Earlier Python/Pandas batch processing, FastAPI with SQL, and immediate construction of the six-stage enterprise pipeline are obsolete as MVP implementation directions.
