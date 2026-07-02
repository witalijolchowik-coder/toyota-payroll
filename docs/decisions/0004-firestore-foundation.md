# ADR 0004: Firestore foundation

- Status: Accepted
- Date: 2026-07-02

## Context

Future modules need one consistent data contract before any business UI starts.
The contract must preserve TETA identity, keep calculated data
server-authoritative, and prevent settled payroll periods from changing.

## Decision

- Separate Firestore document types from domain models. Documents use
  snake_case and `Timestamp`; domain models use camelCase and `Date`.
- Attach runtime-validating converters to every collection boundary.
- Expose typed collection and document references through
  `src/services/firestore`, not directly from React components.
- Store both `employee_id` and `teta_number` on operational documents, but
  never duplicate employee names there.
- Persist daily values only for explicit facts. The virtual 8h/0h defaults do
  not have a document representation or allowed source value.
- Treat absences as their own source of truth.
- Make employee settlements and reports client read-only. Calculation,
  settlement, import-processing, and report-output fields remain server-owned.
- Keep a minimal append-only `auditLog`; this is not a full audit workflow.
- Test Security Rules against the local Firestore emulator with synthetic data.

## Security model

All collection reads require Firebase Authentication. Writes are denied by
default and then granted narrowly:

- employee and open-month manual facts may be coordinator-written;
- settled-month children cannot be written;
- calculated snapshots and generated reports cannot be client-written;
- audit entries may be appended only for the authenticated caller;
- unknown collections and fields are denied.

An admin custom-claim helper is reserved in the rules for later role work.
Cloud Functions using the Admin SDK must independently enforce the settled
month invariant because Admin SDK access bypasses Security Rules.

## Consequences

Feature modules can build on typed, validated Firestore references without
inventing schemas locally. Adding calculation or import functions later will
require server-side write DTOs and invariant checks, but no relaxation of the
browser write surface.
