# Departments, shifts and rotation - Block 7

This document captures the approved foundation for departments, employee shift
assignment and future weekly rotation. It does not introduce payroll
calculation consequences.

## Departments

Department means the employee's current organizational assignment used for
coordination and filtering.

Current department names are:

- Metal
- Szwalnia
- Montaż
- Headliner
- Magazyn
- PU

Departments are editable reference data. Employee documents store a stable
`department_id`, not display-only department text. Historical department changes
are not part of this block.

## Employee color shift assignment

Employees may be assigned to one current color shift:

- zmiana Red
- zmiana White
- zmiana Blue
- unassigned / unknown

In this project UI, Red / White / Blue are called `zmiana`, not `brygada`.

The color shift assignment is stable employee context. It is not a fixed work
time and it does not determine payroll-month participation.

## Actual working shifts

Actual work periods are separate from employee color shifts:

- pierwsza zmiana
- druga zmiana
- nocna zmiana

Example: an employee remains assigned to `zmiana Red`, while weekly rotation may
place Red on first shift one week, night shift another week, and second shift in
another week.

## Two-shift and three-shift departments

A department may be configured as:

- unknown / not configured
- two-shift
- three-shift

Two-shift departments may use only Red and White. Blue may be absent, but the
system must allow it later if the department changes to three-shift work.

Three-shift departments may use Red, White and Blue rotating weekly between
first, second and night shifts.

## Weekly rotation foundation

This block prepares type-safe helpers for future rotation data:

- employee color shift: Red / White / Blue
- actual working shift: first / second / night
- department shift mode: two-shift / three-shift / unknown
- weekly rotation rule

The MVP does not yet implement a graphical schedule planner, automatic schedule
generation or filtering by actual first/second/night shift.

## Payroll boundaries

Department and color shift are context only in this block.

They must not affect:

- payroll-month participation;
- nominal hours;
- worked hours;
- overtime;
- niedoczas;
- allowances;
- final salary calculation.

Payroll-month participation continues to be based only on employment-period
overlap:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

## Implemented now

- `/departments` editable reference collection.
- Employee documents may store `department_id` and `shift_assignment`.
- Employee UI allows editing department and color shift.
- Calendar Constructor can filter employees by department, Red/White/Blue, and
  unassigned department/shift.
- Payroll draft can display department and color shift as identity context.
- Pure helpers cover department key generation, color shift validation,
  department shift mode validation and conservative weekly rotation assignment
  filtering.

## Future work

- Historical department assignment.
- Full rotation setup UI.
- Actual first/second/night shift resolution per selected week.
- Automatic schedule generation.
- Payroll consequences of changed hours, overtime, private time, work-back time
  or niedoczas.
