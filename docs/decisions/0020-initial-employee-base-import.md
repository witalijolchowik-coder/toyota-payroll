# ADR 0020: Preview-first initial employee base import

## Status

Accepted.

## Context

The project needs a practical way to create the first employee base from real
Toyota and SOZ files before importing payroll facts. The source files have
different authority:

- Toyota Excel contains TETA and employment dates.
- SOZ CSV files contain PESEL/passport and housing-related hints, but no TETA.

Creating employees directly from SOZ would require guessing identity and
employment dates.

## Decision

The initial employee import is preview-first:

1. Parse Toyota Excel as the base employee source.
2. Parse SOZ PL and SOZ UA as enrichment sources.
3. Match SOZ rows to Toyota rows only by an exact, unique normalized name
   match.
4. Classify all candidates before writing.
5. Create only selected, valid `new` employees.
6. Do not update or overwrite existing employees.
7. Do not create payroll facts, daily values, absences or settlement documents.

Department mapping is intentionally narrow. NA0 remains unmapped. Shifts remain
unassigned.

Housing information is shown as a warning/hint only unless a future flow lets
the coordinator select a safe accommodation variant.

## Consequences

The import is conservative. Some employees may require manual creation or
manual correction after preview, but no payroll-impacting fact is created by
guessing.

Future import hardening can add server-side batch validation or Cloud Functions
without changing the employee identity rules.
