# ADR 0021: Template-based employee import and bulk update

## Status

Accepted.

## Context

Block 14 introduced a safe initial import from Toyota and SOZ settlement files.
That solved the first population problem, but settlement files are not reliable
as a long-term onboarding source. They may miss future starters or people not
yet included in a settlement.

The employee register also needs a safe way to enrich already imported
employees with missing PESEL/passport, department and shift values without
destroying existing data.

## Decision

The visible coordinator workflow in the Employees module uses application-owned
CSV templates:

1. New employee import template.
2. Bulk employee update template.

Both flows are preview-first and require explicit confirmation. Uploading a file
does not write to Firestore.

The old Toyota/SOZ settlement-file import code can remain in the codebase as a
legacy/internal troubleshooting helper, but it is no longer the normal visible
coordinator workflow.

Bulk updates use TETA as the only matching key. Blank cells mean no change.
Clearing nullable fields requires the explicit `__CLEAR__` marker.

## Consequences

The workflow is less dependent on external settlement file layouts and safer for
day-to-day master-data maintenance.

Some data, especially housing assignments, remains outside the template until a
dedicated effective-dated import format is approved.
