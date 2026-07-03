# General payroll rules

- Specification block: 1
- Status: Approved
- Scope: calendar, nominal hours, employment-period participation, and virtual
  defaults
- Implementation status: documentation only

This document defines the general payroll rules that future calculation and
attendance modules must follow. It does not authorize or implement payroll
calculation code.

## 1. Calendar basis

The base payroll calendar follows the Polish working calendar:

- standard working days are Monday through Friday;
- a standard working day contains `8h`;
- Polish public holidays are non-working by default.

The calendar model must allow coordinator-defined overrides in a future
implementation:

- an additional working day;
- an additional non-working day;
- a Toyota- or client-specific day;
- a manual calendar correction.

An override changes the payroll classification of the affected calendar date.
The detailed override workflow and persistence model are not defined in this
block.

## 2. Month nominal hours

Month nominal hours are one common value for the payroll month. They do not
depend on a specific employee.

The future calculation basis is:

```text
month_nominal_hours = working_days_in_month × 8h
```

`working_days_in_month` is determined after applying Polish public holidays
and all effective calendar overrides.

## 3. Individual employee nominal hours

Individual nominal hours are calculated separately for each employee:

- for employment covering the full month, individual nominal hours normally
  equal month nominal hours;
- when employment starts or ends inside the month, individual nominal hours
  are reduced to the working dates that fall inside the employee's employment
  period.

The employment-date test is inclusive:

```text
employment_start <= date
AND
(employment_end is null OR date <= employment_end)
```

Only dates classified as working by the effective payroll calendar contribute
nominal hours. Current `is_active` status must not affect individual nominal
hours.

## 4. Employment dates and non-working days

`employment_start` normally represents the BHP/start date and is expected to
be a working payroll date.

For payroll purposes, `employment_end` should normally be entered as a working
date even when employment paperwork may technically contain a different
termination date.

If `employment_start` or `employment_end` falls on a weekend or public
holiday, that date contributes `0h` nominal hours unless an effective calendar
override classifies it as working.

The normal coordinator workflow should therefore use working-day payroll dates
for employment start and end.

## 5. Payroll-month participation

An employee participates in payroll month `M` when the employment period
overlaps that month:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

This includes an employee who is inactive today but worked during the selected
historical payroll month.

Participation determines whether the employee belongs to the month. Individual
nominal hours are then limited to working dates inside the employment period.

## 6. Current HR status and payroll participation

`is_active` describes current HR status for daily coordination. It supports
current workforce management such as:

- active-staff coordination;
- absence and overtime planning;
- housing and transport coordination;
- other day-to-day operations.

It must not determine participation in a historical payroll month and must not
replace the employment-period overlap rule.

## 7. Virtual default hours

Virtual default `8h` avoids manual entry for standard worked days. It is a
derived fallback and is never written to Firestore.

For future payroll calculation, an empty working date inside the employee's
employment period counts as `8h` when no absence, explicit manual value, or
imported value governs that date.

For coordinator-facing UI, future dates in the current month show a dash or a
muted empty value rather than planned `8h`.

The UI and future calculation can therefore represent the same empty date
differently:

```text
current-month future UI: dash
closed or past payroll-period calculation: virtual 8h fallback
```

This display distinction does not create a persisted daily-value document.

## 8. Non-working days

Weekends and public holidays contribute `0h` nominal hours by default.

Hours explicitly entered by a coordinator on a non-working date are worked
hours. They are not nominal hours and are not virtual defaults.

Overtime, weekend work, and public-holiday work treatment belongs to the
separate Attendance Rules specification.

## 9. Values outside the employment period

Hours, absences, and imported facts outside an employee's employment period
are not normal payroll facts. They must not silently enter payroll
calculation.

Such facts must produce a warning, review item, or validation issue requiring
a coordinator decision. The future workflow will define whether individual
cases can be corrected, accepted, or rejected.

## 10. Missing employment start

In normal data, every employee must have `employment_start`.

When it is missing:

- the employee cannot be reliably assigned to a payroll month;
- the MVP excludes the employee from the payroll-month view and calculation;
- the MVP shows a warning requiring coordinator attention.

A future data-quality workflow should treat missing `employment_start` as a
blocking issue.

## Deferred specifications

This block does not define:

- detailed attendance, overtime, weekend-work, or holiday-work treatment;
- absence effects;
- bonuses or adjustments;
- payroll totals or calculation sequencing;
- calendar-override UI or persistence;
- calculation implementation.

Those subjects require their own approved business-rules blocks before
implementation.
