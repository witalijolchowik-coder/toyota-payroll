# ADR 0022: Department schedule planning foundation

## Status

Accepted

## Context

Monthly Settlement needs a planned schedule layer before final payroll closing
can be made reliable. Existing employee department and color group fields are a
current coordination snapshot, but monthly schedule evaluation must respect
effective dates and historical transfers.

## Decision

- Keep the current employee `department_id` and `shift_assignment` fields as
  the latest coordination snapshot.
- Add effective-dated `/employeeAssignments` records for historical
  department/color-group evaluation.
- Keep the MVP department directory canonical: Metal, Szwalnia, Montaż, PU,
  Headliner and Magazyn.
- Store department-local rotation anchor data on department documents.
- Add month-owned `/months/{monthId}/scheduleCorrections` for future explicit
  planned-schedule overrides.
- Render Monthly Settlement with a default hours mode and an optional shifts
  mode instead of replacing worked-hour visibility.
- Treat BHP as planned working time: first two working days, 8h, first shift.

## Consequences

The planner can show and validate schedule readiness without changing actual
attendance, imported daily values, absences or payroll results. Later payroll
calculation stages can consume the same pure schedule utilities.

Server-authoritative schedule finalization, multi-user approval and month close
remain future work.
