# ADR 0002: Employee identifiers

- Status: Accepted
- Source: TETA Identifier Amendment

## Decision

Every employee has two distinct identifiers:

| Identifier    | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `employeeId`  | Firestore document relationships only                                                              |
| `teta_number` | Authoritative business identity for coordinators, imports, reports, SOZ, and external integrations |

Operational documents store both identifiers but do not duplicate employee names.

## Invariants

- TETA is required.
- TETA is unique across active employees.
- Imports match by TETA, then resolve the Firestore document ID.
- No-match and multiple-match cases require coordinator resolution; IDs are never guessed.
- Firestore document IDs are not exposed as business identifiers.

Enforcement is deferred to the Employees implementation step. This bootstrap documents the contract but creates no employee logic.
