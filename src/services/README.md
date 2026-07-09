# Services boundary

Firebase reads, writes, callable functions, and Storage operations belong here as feature work begins. React components should depend on typed service functions rather than importing Firebase SDK operations directly.

Step 3 adds:

- runtime-validating converters for every MVP document type;
- domain mappers that keep Firestore timestamps out of UI-facing models;
- canonical path and document-ID helpers;
- typed collection/document boundaries for future repositories.

The Employees module composes these boundaries in `employeesService.ts` for
subscribed reads, creates, edits, and deactivation. Future feature services
should follow the same pattern and accept the restricted client-write types
from `src/types/firestore/writes.ts`.

The settlement shell composes the month, employee, daily-value, absence,
payroll-setting, and adjustment boundaries in `settlementService.ts`. Loading
is read-only; a separate coordinator action transactionally creates only the
initial canonical month document. Calculation drafts are built in memory by
pure payroll helpers and are not persisted here.

`dailyValueService.ts` transactionally creates, updates, and clears canonical
manual daily-value documents. For an imported document it changes only the
audited `manual_override`, preserving the original import; clearing the
override restores that source value. Firestore Rules enforce the open-month
and immutable-base-field boundaries.

`absencesService.ts` owns cross-month absence reads plus manual create, edit,
and cancellation. L4 overlap prevention is currently a client-side preflight
backed by reusable pure helpers.

The Calendar Constructor in the settlement workspace composes
`dailyValueService.ts` and `absencesService.ts` for range-based coordinator
corrections. It does not introduce a separate service or persisted calendar
status model.

`payrollSettingsService.ts` creates and reads append-only global setting
versions. It rejects versions that would begin in settled history and leaves
effective-month resolution to the pure payroll helper.

`adjustmentsService.ts` owns monthly employee adjustment reads, creates,
edits, and lifecycle cancellation. Every mutation verifies that the owning
month exists and remains open.
