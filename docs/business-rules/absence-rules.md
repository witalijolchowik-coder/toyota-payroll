# Absence rules

- Specification block: 2
- Status: Approved
- Scope: absence records, lifecycle, overlap priority, workspace, and
  settlement display

## Source of truth and record identity

Absence documents are the sole source of truth. Settlement cells only display
their consequence and never create or mutate absence records.

One source record creates one Firestore document. In particular, one L4
certificate remains one record. Consecutive or visually continuous
certificates are not merged.

## Types and lifecycle

The MVP supports `L4`, `UW`, `UZ` (displayed as UŻ / UZ), `NN`, `NU`, `NI`,
`OPD`, `KRW`, and `WZN`.

Every absence has lifecycle status `ACTIVE` or `CANCELLED`. Cancellation
replaces deletion. Priority never changes lifecycle status and
`SUPERSEDED` is not used.

## Ownership and cross-month display

An absence is stored once under the month containing `start_date`:

```text
/months/{startMonthId}/absences/{absenceId}
```

It is displayed and evaluated in every month overlapped by its inclusive
`start_date`–`end_date` range. Reads therefore use the `absences` collection
group and retain the owning month from the document path.

Changing `start_date` to another ownership month is not an in-place edit.
The coordinator must cancel the old record and create a corrected record in
the correct month.

## Priority and corrections

An ACTIVE L4 blocks creation or editing of an overlapping non-L4 absence for
the same employee. Adding L4 over an existing non-L4 absence is allowed; both
records remain ACTIVE and day-by-day evaluation gives L4 priority.

Ordinary non-L4 category corrections update the same ACTIVE manual record.
If several different ACTIVE non-L4 categories cover the same employee-day,
the resolver reports ambiguity instead of inventing a priority.

This stage enforces L4 blocking in the browser and exposes pure helper logic.
Server-authoritative enforcement is documented hardening for a future Cloud
Function; concurrent clients can still race.

## Calendar and employment boundaries

Absence records retain their full range across weekends and public holidays.
The displayed absence code replaces the virtual default, while a non-working
day contributes no default worked hours.

An absence outside the employee employment period remains stored but is marked
for coordinator review. It must not silently enter future payroll
calculation.

## Workspace summaries

The Absences workspace shows current-day cards:

- `Na L4 dzisiaj`: `L4`;
- `Na urlopie / usprawiedliwione`: `UW`, `UZ`, `OPD`, `KRW`, `WZN`;
- `Nieobecności niewyjaśnione`: `NN`, `NU`, `NI`.

The main Dashboard is unchanged in this block.

## Deferred work

This block does not implement payroll amounts, final absence-hour
consequences, imports, reports, ZUS integration, bonuses, a ReviewQueue, or
server-side overlap enforcement.
