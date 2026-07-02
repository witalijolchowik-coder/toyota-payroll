# ADR 0007: Month initialization and settlement shell

- Status: Accepted
- Date: 2026-07-02

## Context

The monthly settlement screen needs a stable calendar and employee population
before daily editing or payroll calculation is introduced. Month creation must
be safe for the browser while calculation and settlement fields remain
server-owned.

## Decision

- Select months by canonical `YYYY-MM` IDs, defaulting the UI to the previous
  month because payroll is normally prepared in the following month.
- Reading or selecting a missing month performs no write. Show a compact empty
  calendar preview and require the coordinator to choose **Utwórz miesiąc**.
- After that explicit action, create the month transactionally with canonical
  UTC `month_start` and `month_end`, `is_settled: false`, and
  `calculation_version: 0`.
- Allow the browser to set that calculation version only during initial
  creation. Later calculation and settlement changes remain denied by
  Firestore Security Rules.
- Populate settlement rows strictly by employment-period overlap as defined in
  ADR 0006. Do not filter by current `is_active`.
- Read explicit daily values but keep every cell read-only.
- Render an in-memory `8h` default only for elapsed working days inside the
  employee's employment period when no daily value exists.
- Keep public-holiday classification behind a provider boundary. The initial
  provider contains no holiday database.
- Show a read-only banner when the selected month is settled.

## Security

Month creation requires Firebase Authentication, caller-bound creation
metadata, exact allowed fields, exact UTC month boundaries, an open settlement
state, and calculation version zero. Month deletion, client settlement, and
client calculation updates remain denied.

## Consequences

The application now has a Firestore-backed monthly calendar foundation without
implementing payroll calculations or daily editing. Selecting or viewing a
month is side-effect free. Virtual defaults remain presentation-only and do
not create `dailyValues` documents.
