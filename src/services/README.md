# Services boundary

Firebase reads, writes, callable functions, and Storage operations belong here as feature work begins. React components should depend on typed service functions rather than importing Firebase SDK operations directly.

Step 3 adds:

- runtime-validating converters for every MVP document type;
- domain mappers that keep Firestore timestamps out of UI-facing models;
- canonical path and document-ID helpers;
- typed collection/document boundaries for future repositories.

The application shell still performs no reads or writes. Future feature
services should compose these boundaries and accept the restricted client-write
types from `src/types/firestore/writes.ts`.
