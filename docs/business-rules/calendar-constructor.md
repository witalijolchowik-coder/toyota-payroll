# Calendar Constructor

- Specification block: 6
- Status: Approved for UI foundation implementation
- Scope: visual monthly planning, review, and coordinator corrections

The Calendar Constructor is an input and review layer over the existing payroll
month data. It does not introduce a separate calendar status model.

## Source documents

The constructor reuses existing entities:

- `Employee`;
- `Month`;
- `DailyValue`;
- `DailyValue.manual_override`;
- `Absence`;
- in-memory payroll calculation draft warnings.

## Tool mapping

Constructor tools map to existing documents:

| Tool       | Underlying operation                                     |
| ---------- | -------------------------------------------------------- |
| `Godziny`  | create/update manual `DailyValue` or imported override   |
| `L4`       | create an `Absence` with `absence_code = L4`             |
| `Urlop`    | create an `Absence` with `absence_code = UW`             |
| `UŻ / UZ`  | create an `Absence` with `absence_code = UZ`             |
| `NN`       | create an `Absence` with `absence_code = NN`             |
| `Wyczyść`  | clear manual attendance only                             |
| `Przegląd` | open employee-focused calendar without writing documents |

Absence tools use the existing absence service, validation, start-month
ownership, L4 blocking, and ACTIVE/CANCELLED lifecycle rules.

The clear tool does not delete imported base data. It deletes standalone manual
daily values, clears `manual_override` on imported values, and preserves
imported values without an override.

## Selection model

The MVP supports selecting one continuous date range for one employee. This is
safe enough for coordinator work and avoids accidental multi-employee painting
before undo/review workflows are specified.

Multi-row painting is deferred.

## General calendar grid

The general grid keeps employees as rows and month dates as columns. Cells show
the existing settlement states:

- attendance hours;
- virtual/manual/imported/import-override state;
- absence code;
- attendance and absence conflicts;
- warning indicators;
- outside-employment state;
- weekend/public-holiday state;
- settled/read-only state.

Filtering is implemented for supported existing data:

- employee search by name or TETA;
- absence type for currently represented types;
- conflict rows;
- warning rows;
- month participants.

Department and shift filters are not implemented because department and shift
are not yet represented in the employee model.

## Employee calendar

The employee-focused calendar opens from review mode and shows a classic
weekday layout for the selected month. It displays employee identity, TETA,
employment period, daily hours, absences, warnings, and read-only state.

Detailed hour editing uses the existing daily-value editor and attendance
service. Absence creation uses the general constructor tools.

## Read-only and validation behaviour

Settled months are read-only. Constructor write tools are disabled.

Writes outside the employment period are blocked in the constructor. Existing
warnings still display facts that were already present outside employment.

The constructor does not implement financial consequences for overtime,
holiday work, absences, transport, accommodation, UDT, tax, ZUS, or final
salary.

## Deferred work

- multi-row painting;
- undo/review queue for bulk changes;
- department and shift filters after those fields are modeled;
- overtime and undertime payroll semantics;
- final calculation, closing, exports, reports, and server-authoritative
  enforcement.
