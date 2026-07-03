# Attendance and hours rules

- Specification block: 3
- Status: Approved
- Scope: explicit worked-hour facts, precedence, validation, and settlement
  presentation

## Explicit facts and virtual defaults

A `DailyValue` document exists only for an explicit worked-hour fact:

- a coordinator's manual entry (`manual`);
- an imported attendance value (`attendance_import`);
- a future approved source.

Virtual `8h` and `0h` values are derived fallbacks and are never persisted.
Clearing a manual fact restores the governing absence, eligible virtual
default, or empty state.

## One employee-day, one document

The canonical document remains:

```text
/months/{monthId}/dailyValues/{employeeId}_{YYYY-MM-DD}
```

There is at most one effective `DailyValue` document for an employee-day.
Imported facts and coordinator corrections are not stored as duplicate daily
records.

## Manual values

A coordinator may create, update, or clear a manual worked-hour fact while the
month is open. Its source is `manual`.

Clearing a standalone manual document deletes that explicit fact. It does not
persist a virtual default and does not modify an absence.

## Imported values and manual overrides

An imported value is an explicit, system-owned attendance fact. Its base
fields are read-only for the browser.

An imported document may carry an optional `manual_override`:

```text
manual_override:
  hours
  note
  actor_uid
  updated_at
```

The effective displayed value is:

```text
manual_override.hours ?? hours
```

Adding or changing an override never overwrites the original imported
`hours`, `source`, `import_id`, identity, or import note. Clearing the override
sets it to `null` and restores the original imported value. Only the override
and its audit metadata may be changed by an authenticated coordinator in an
open month.

This block prepares the model for a future import engine but does not implement
import parsing or import application.

## Absences and worked hours

An ACTIVE absence remains the primary cell label and takes precedence over a
virtual default.

If an explicit DailyValue also covers that employee-day:

- both the absence code and effective worked hours remain visible;
- the cell shows a conflict warning;
- neither record is silently ignored, changed, or deleted.

The payroll consequence of this conflict is deferred.

## Calendar and employment warnings

Weekends and holidays have no worked-hour virtual default beyond the existing
derived `0h` UI fallback. Explicit worked hours on a non-working date are
allowed and visibly marked as non-standard.

An explicit worked-hour fact outside the employee's inclusive employment
period is preserved and visibly marked for review. It must not silently become
a normal payroll fact.

## Validation and formatting

Worked hours:

- must be a finite number;
- may be `0`;
- may contain decimals;
- must be between `0` and `24`, inclusive.

Polish UI formats decimal values with a comma and the `h` suffix, for example
`8 h` and `7,5 h`.

An explicit value below or above `8h` on a working date is valid. Overtime,
undertime, holiday-work classifications, and their payroll consequences are
not defined in this block.

## Settlement states

The Monthly Settlement grid distinguishes:

- virtual default;
- standalone manual value;
- imported value;
- manual override of an imported value;
- absence;
- attendance conflict or warning;
- weekend or holiday;
- outside-employment fact;
- settled-month read-only state.

Settled months remain read-only. This block does not implement payroll
aggregation, overtime calculation, imports, or reports.
