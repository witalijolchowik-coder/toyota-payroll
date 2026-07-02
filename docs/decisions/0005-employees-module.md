# ADR 0005: Employees module

- Status: Accepted
- Date: 2026-07-02

## Context

The first Firestore-backed business module needs to manage the canonical
employee register without leaking internal document identifiers or introducing
payroll behavior. The UI is Polish, while Firestore continues to use the
document and domain contracts established in Step 3.

## Decision

- Keep feature UI, state, and pure employee validation under
  `src/features/employees`.
- Keep Firebase SDK operations in `src/services/employeesService.ts` and use
  the existing typed employee repository, converter, and mapper boundaries.
- Treat normalized uppercase TETA as the primary business identifier.
- Check TETA uniqueness case-insensitively against active employees before
  create and update operations. Inactive employees do not reserve a TETA.
- Keep Firestore employee document IDs internal and never render them in the
  coordinator UI.
- Deactivate employees by setting `is_active` to false. Do not expose a delete
  operation.
- Treat `is_active` only as the current HR status for daily coordination.
  Historical payroll-period participation is determined from employment-date
  overlap and must not depend on the current status.
- Store Polish UI copy in a typed translation resource rather than in React
  components. A full locale-switching framework is deferred until another
  locale is required.
- Require an existing Firebase Authentication session for Firestore writes.
  Do not add anonymous sign-in or weaken authenticated-only Security Rules.

## Uniqueness boundary

Firestore Security Rules cannot query the employee collection to enforce a
unique field. The module therefore performs the required active-TETA preflight
check before every create or update. This prevents ordinary duplicate entry
but is not an atomic uniqueness guarantee across concurrent clients.

If concurrent multi-user editing becomes a requirement, a server-authoritative
TETA reservation mechanism must be added as a separate approved architecture
change.

## Consequences

The employee register can be listed, searched, created, edited, and
deactivated using the Step 3 data layer. Employee names remain canonical only
in `/employees`; no operational document schemas are changed.
