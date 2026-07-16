# ADR 0026: Business settings navigation and shared calendar appearance

## Decision

Global settings are divided into four business subsections: **Zmiany i
grafiki**, **Zakwaterowanie**, **Premie i dodatki** and **Interfejs**. The
selected subsection is represented by the `section` query parameter and saved
locally so leaving and returning to settings restores the coordinator's last
context. The generic payroll-setting table remains available only as a
collapsed technical diagnostic view.

Calendar appearance is one application-wide configuration stored at
`appConfig/calendarAppearance`. It contains only a schema version, complete
text/background color maps and standard modification metadata. Approved users
may read it; only an approved administrator may write it. Defaults remain in
the client so a missing document never produces an empty or unreadable
calendar.

The visual priority for a day cell is:

1. structural or primary fact supplies the cell background;
2. the effective worked-hours value or absence/shift abbreviation is primary
   text;
3. overtime, manual correction, warning and review facts remain compact text,
   icons or outlines rather than competing full-cell backgrounds.

The same palette mapping is used by the common monthly calendar, personal
employee calendar, legend and settings preview. Each state can be reset, the
whole palette can be reset, and low WCAG contrast produces a warning without
blocking unusual color choices.

## Monthly workspace layout

The monthly workspace is calendar-first. The month/count/calculation controls
are compact, recovery points open in a dialog, and the legend is collapsed by
default near the filters. Calendar tools precede the grid.

The grid uses a sticky date header inside its vertical scroll container and a
sticky employee column for horizontal movement. Employees are sorted by the
effective department assignment in the order Metal, Szwalnia, Montaż, PU,
Headliner, Magazyn and then by surname. Missing assignments form the final
`Brak przypisanego działu` group. Department separation is limited mainly to
the employee block.

Day cells reserve a stable primary and secondary row so an overtime marker does
not move the main hours baseline. Wide desktop layouts use compact day columns
and almost the whole content width; narrower layouts retain internal horizontal
scrolling. These rules apply to both `Godziny` and `Zmiany` modes.

## Consequences

- No payroll formulas, export schemas or monthly business documents change.
- The palette is global, not per user, month, department or project.
- Palette loading occurs once through the application provider rather than per
  cell or employee.
- Critical states continue to carry text, abbreviations, icons or outlines;
  color is supplementary.
