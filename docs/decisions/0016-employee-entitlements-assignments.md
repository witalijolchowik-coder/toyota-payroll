# ADR 0016: Employee Entitlements and Assignments

## Status

Accepted.

## Context

Monthly Settlement components such as UDT, own housing allowance and company
accommodation cannot be derived from department, shift or employee name. They
are employee-level facts and must remain historically correct across payroll
months.

## Decision

Use a top-level `employeeEntitlements` collection for employee-level
entitlements and assignments.

Each document stores:

- `employee_id`;
- `teta_number`;
- `type`;
- `accommodation_variant_key` when type is `COMPANY_ACCOMMODATION`;
- `valid_from`;
- `valid_to`;
- `status`;
- `note`;
- audit metadata.

Supported types:

- `UDT`;
- `OWN_HOUSING_ALLOWANCE`;
- `COMPANY_ACCOMMODATION`.

The collection is top-level rather than a subcollection under employees so that
Monthly Settlement can load all relevant employee facts once and resolve them in
pure TypeScript helpers.

## Consequences

- Employee names are not duplicated in operational documents.
- Entitlements can be shown and edited from the employee workspace.
- Monthly Settlement can resolve UDT, own housing and company accommodation from
  real effective-dated data.
- Hard deletes are denied; cancellation is represented by `status`.
- Because the documents are global and effective-dated, settled-month
  protection cannot be fully enforced by Firestore rules alone until a payroll
  closing/snapshot mechanism exists. This is documented as a future hardening
  requirement.
