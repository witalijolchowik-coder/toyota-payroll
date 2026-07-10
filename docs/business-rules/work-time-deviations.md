# Work time deviations, private time and overtime - Block 8

- Specification block: 8
- Status: Approved
- Scope: planned-vs-actual work-time interpretation, overtime buckets, and
  monthly balancing foundation
- Implementation status: foundation implemented; final salary calculation is
  not implemented

## Calendar and daily plan

The active MVP assumption is that employees have an `8h` daily nominal on
scheduled working days.

Default actual working shifts are:

- first shift: `06:00-14:00`;
- second shift: `14:00-22:00`;
- night shift: `22:00-06:00`.

If no correction exists, the system assumes that the employee worked the
planned interval exactly. That gives:

- normal work equal to the planned working interval;
- no private time;
- no overtime.

The model must remain extensible for a future department pattern such as
`10h x 4 days`, but this rule is not active yet.

## Planned interval vs actual interval

Payroll meaning should be derived from a planned work interval compared with
an actual work interval where the coordinator has provided one.

An actual interval does not move the shift. For example, planned `06:00-14:00`
and actual `09:00-17:00` means:

- `06:00-09:00` is private time;
- `09:00-14:00` is normal work;
- `14:00-17:00` is extra time available for monthly balancing.

## Overtime categories

Payroll totals use only two overtime buckets:

- `nadgodziny 50%`;
- `nadgodziny 100%`.

All qualifying 100% sources are summed into the single `nadgodziny 100%`
bucket. The payroll output must not split separate payment totals for night,
Saturday, Sunday or public-holiday work.

The engine may preserve reasons internally for explanation and review.

## 100% overtime sources

100% overtime includes:

- overtime during night time (`22:00-06:00`);
- Saturday work;
- Sunday work;
- official public-holiday work.

Saturday, Sunday and public holidays have `0h` nominal by default. Work on
those dates is explicit 100% overtime and does not create an automatic `8h`
missing-time problem.

## Public-holiday bonus

Public-holiday work may trigger one fixed `300 PLN` bonus for the relevant
settlement period.

Implemented now:

- the foundation exposes holiday-work bonus eligibility as a boolean;
- no final amount is posted to salary totals.

Future calculation work must connect this eligibility to approved settings and
the final payroll aggregation.

## Night allowance boundary

Night allowance `20%` exists for ordinary night hours, but it must not be added
on top of overtime already classified as `nadgodziny 100%`.

There is no payroll category `nadgodziny 100% + dodatek nocny 20%`.

## Private time and niedoczas

`Czas prywatny` occurs when planned work time is missed because the employee
starts late or leaves early.

Monthly balancing uses extra/overtime hours from the same month to cover
private time before the remaining hours are treated as payable overtime.
Chronological order does not matter.

If private time is not covered, it becomes `niedoczas` in the monthly
foundation totals.

## Shift-displacement NI

Ordinary `NI` is not automatically covered by overtime.

When production shifts the work week, a missing planned shift can be manually
marked as coverable. Eligible extra/overtime hours may then cover it in the
monthly balance.

This block implements the pure balancing model for coverable NI. The UI for
marking a specific NI as coverable remains future work.

## Balancing assumption

The approved rules do not define which overtime bucket should be consumed first
when both 50% and 100% hours can cover private time or coverable NI.

Current foundation assumption:

1. consume 50% overtime first;
2. then consume 100% overtime.

This avoids reducing the more specific 100% bucket unless necessary. If payroll
policy later defines a different order, only the monthly balancing helper must
change.

## Data model

The implementation extends the existing one-document-per-employee-day
`DailyValue` model. It does not introduce a parallel attendance collection.

Optional field:

```text
dailyValues/{employeeId_YYYY-MM-DD}.work_time_correction
```

stores:

```text
planned_shift
planned_start_time
planned_end_time
actual_start_time
actual_end_time
classification_override
```

`classification_override` is optional and audited. It can provide corrected
private time, overtime 50%, overtime 100% or coverable NI hours when automatic
classification is insufficient.

Existing `hours`, imported base facts and `manual_override` behavior remain
unchanged.

## Implemented now

- Pure helpers for planned shift intervals, actual interval comparison,
  private time, overtime 50%, overtime 100%, public-holiday eligibility and
  monthly balancing.
- DailyValue converters, mappers and Firestore rules accept optional
  `work_time_correction`.
- Employee day editor can store actual start/end time and planned working
  shift.
- Payroll draft shows work-time foundation totals.

## Future work

- Final salary calculation.
- Final payroll closing.
- Full graphical schedule planner.
- Automatic rotation/schedule generation.
- UI for detailed classification override fields.
- UI for marking a concrete NI as coverable due to shift displacement.
- Import engine integration.
- Reports, PDF/Excel export, tax, ZUS, transport, accommodation and UDT
  calculation.
