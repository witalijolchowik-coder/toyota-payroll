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

The settlement shell composes the month, employee, and daily-value boundaries
in `settlementService.ts`. Loading is read-only; a separate coordinator action
transactionally creates only the initial canonical month document.

`dailyValueService.ts` transactionally creates, updates, and clears canonical
manual daily-value documents. It refuses imported values and relies on
Firestore Rules for open-month enforcement.

`absencesService.ts` owns cross-month absence reads plus manual create, edit,
and cancellation. L4 overlap prevention is currently a client-side preflight
backed by reusable pure helpers.
