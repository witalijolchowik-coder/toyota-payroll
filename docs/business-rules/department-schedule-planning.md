# Department structure and monthly schedule planning — Block 18

This block defines the operational monthly planned schedule layer. It does not
calculate payroll amounts and does not close or freeze a month.

## Canonical departments

The MVP department directory contains exactly these canonical departments:

- Metal
- Szwalnia
- Montaż
- PU
- Headliner
- Magazyn

Other names, including Lakiernia, PEN and Podsufitki, are not automatically
created or displayed as selectable MVP departments. `NA0` is not a department.
It must stay unresolved and visible for manual assignment; it must not be
automatically mapped to PU or Headliner.

Department import and update matching is tolerant of case, whitespace and
Polish diacritics for canonical names. Unknown names remain unresolved.

## Department shift modes

- Szwalnia uses two shifts.
- PU and Headliner currently use two shifts and may transition to three shifts
  by an effective-dated configuration in a later hardening step.
- Metal, Montaż and Magazyn use three shifts.

Two-shift departments allow Red and White groups. Three-shift departments
allow Red, White and Blue groups.

## Local weekly rotations

Rotations are local to each department. Red, White and Blue alignment is not a
global system-wide fact.

Three-shift departments rotate weekly:

```text
Night → Second → First → Night
```

Two-shift departments rotate weekly:

```text
First → Second → First
```

Each department carries a rotation anchor week and base group-to-shift
assignment. The initial MVP anchor is a technical default and can be adjusted
later without changing employee identity.

## Effective-dated assignments

The employee record keeps the current department and color group as a current
coordination snapshot. Historical schedule evaluation uses effective-dated
assignment documents.

When an employee's department or color group changes, the coordinator must
provide the effective date. Dates before that date retain the previous
assignment; dates from that date use the new assignment. History is not
destroyed.

## BHP days

BHP is working time, not an absence.

The first two working days from employment start are planned as:

```text
BHP / first shift / 8h
```

Weekends and Polish public holidays do not consume BHP days. BHP always counts
as 8 planned working hours on first shift.

## Monthly planned schedule

The schedule planner uses:

- employment start and end dates;
- effective employee assignment on each date;
- department shift mode and rotation anchor;
- Polish public holidays;
- future calendar exceptions;
- future manual schedule corrections.

The planner must not overwrite actual attendance, daily values or absences.
It only produces a planned view used by readiness and the monthly calendar.

## Calendar display

The monthly calendar supports two display modes:

- hours — default operational worked-hours view;
- shifts — planned schedule view showing `1`, `2`, `N`, `BHP / 1`, `W`, `Ś`
  or unresolved markers.

Planned shifts are informational until later calculation and closing stages
turn them into authoritative payroll inputs.

## Readiness

If the planned schedule cannot be determined for a relevant employee-day, the
month readiness view must surface an unresolved schedule issue. The practical
fix is normally to correct department, color group or assignment effective
dates.
