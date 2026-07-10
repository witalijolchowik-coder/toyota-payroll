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
- [Attendance and hours rules — Block 3](business-rules/attendance-hours-rules.md)
  — explicit worked-hour facts, imported-value overrides, precedence, and
  warning states
- [Payroll settings and employee adjustments - Block 4](business-rules/payroll-settings-adjustments.md)
  - effective-dated global configuration, frequency bonus, and monthly
    coordinator adjustments
- [Payroll engine foundation - Block 5](business-rules/payroll-engine-foundation.md)
  - in-memory monthly calculation drafts, safe totals, and warning breakdowns
- [Calendar Constructor - Block 6](business-rules/calendar-constructor.md) -
  visual monthly planning and corrections over existing attendance and absence
  documents
- [Departments, shifts and rotation - Block 7](business-rules/departments-shifts-rotation.md)
  - editable departments, Red/White/Blue employee shift assignment, and future
    weekly rotation foundation
- [Work time deviations, private time and overtime - Block 8](business-rules/work-time-deviations.md)
  - planned-vs-actual intervals, overtime buckets, and monthly balancing
    foundation

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
- [ADR 0009: Attendance facts and imported-value overrides](decisions/0009-attendance-hours-rules.md)
- [ADR 0010: Versioned payroll settings and monthly adjustments](decisions/0010-payroll-settings-adjustments.md)
- [ADR 0011: In-memory monthly payroll calculation draft](decisions/0011-payroll-engine-draft.md)
- [ADR 0012: Calendar Constructor reuses attendance and absence documents](decisions/0012-calendar-constructor.md)
- [ADR 0013: Departments, color shifts and rotation foundation](decisions/0013-departments-shifts-rotation.md)
- [ADR 0014: Work-time deviations extend DailyValue](decisions/0014-work-time-deviations.md)

## Authority order

When documents appear to conflict, use this order:

1. MVP Scope Definition v1.0
2. TETA Identifier Amendment
3. Phase 1 Implementation Plan amendments
4. Phase 1 Implementation Plan
5. Technical Platform Baseline v1.0
6. Earlier locked enterprise architecture as future-reference material only

Earlier Python/Pandas batch processing, FastAPI with SQL, and immediate construction of the six-stage enterprise pipeline are obsolete as MVP implementation directions.
