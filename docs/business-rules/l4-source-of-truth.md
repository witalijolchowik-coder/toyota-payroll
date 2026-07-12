# L4 source of truth, status model and import reconciliation

## Source of truth

Imported L4 from the operational ZUS Excel report is the authoritative payroll
source. Manual L4 is a preliminary declaration only.

Manual L4 must not override, shorten, extend or contradict imported ZUS data.
When imported L4 corresponds to a manual declaration, the imported data wins and
there must be one effective absence for calendar, counters and settlement.

## User-facing L4 statuses

The coordinator-facing L4 status model has exactly three normal statuses:

- `Zgłoszone` — manually entered L4 that is not yet confirmed by ZUS import.
- `Aktywne` — imported L4 where `start_date <= today <= end_date`.
- `Nieaktywne` — imported L4 where `end_date < today`.

Firestore `status: ACTIVE` remains a technical lifecycle marker. It must not be
shown as the L4 business status.

## Future-start imported L4

Imported L4 may end in the future when it already started. It may not start in
the future as a normal absence.

Rows where `start_date > today` are treated as import anomalies. They are shown
in preview and are not written automatically.

## Reconciliation

Import preview compares incoming ZUS rows with existing imported L4 and manual
L4:

- exact imported duplicate is skipped;
- matching or clearly overlapping manual L4 is confirmed by the import;
- confirmed imported overlap remains a review conflict;
- non-L4 overlap remains a review conflict;
- missing owner month remains blocked.

The preferred technical outcome is converting the existing manual L4 document to
`source: absence_import` in the same owner month when safe. This preserves
document history and avoids duplicate payroll impact.

## Counters and filters

`Na L4 dzisiaj` counts unique employees on confirmed imported L4 where today is
inside the period. Manual `Zgłoszone` L4 is not counted as confirmed L4 today.

For the L4 type filter, available status filters are:

- `Wszystkie`;
- `Zgłoszone`;
- `Aktywne`;
- `Nieaktywne`.

## Calendar and payroll effect

Calendar cells distinguish preliminary manual L4 from confirmed imported L4.
Confirmed imported L4 displays through the full stored range, including future
days after today when the absence already started.

Payroll/settlement foundation treats imported L4 as the authoritative absence
source. Manual `Zgłoszone` L4 remains visible operationally and produces a
warning, but it is not silently counted as confirmed payroll sickness.
