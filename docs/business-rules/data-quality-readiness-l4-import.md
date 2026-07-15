# Data quality readiness and L4 import

This document records Block 17 operational-readiness rules.

## Readiness levels

- Blocking issues prevent safe month preparation. Example: a missing employment
  start date or a missing month document.
- Warnings require coordinator review before payroll/export use. Examples:
  missing identity data for SOZ, unresolved `NA0`, inactive departments,
  missing payroll settings, overlapping assignments or unresolved calendar
  exceptions.
- Optional issues are allowed during onboarding but remain visible, such as a
  missing department or color shift.
- Informational statuses explain what is present and what is intentionally not
  final yet.

## Employee readiness

Operational employee records require TETA, first name, last name and employment
start date. Existing legacy records without an employment start remain visible
and editable; they are not hidden or deleted.

Payroll-period participation continues to use employment-period overlap, not
current `is_active`:

```text
employment_start <= month_end
AND
(employment_end is null OR employment_end >= month_start)
```

Missing identity data is visible before SOZ export. The system does not infer
nationality from names and does not require a passport from every Polish
employee.

`NA0` is not a real department. It is never mapped automatically to PU,
Headliner or any other department.

## Settings and assignment readiness

The readiness view checks whether known payroll settings have an active value
for the selected month and whether effective-dated settings overlap.

Employee entitlements are checked for overlapping periods, contradictory own
housing/company accommodation assignments and missing company accommodation
variants. These are readiness warnings, not final payroll calculations.

## Calendar readiness

Polish working-calendar helpers exist, but Toyota-specific calendar overrides
are still not production-governed. The month can therefore show a warning until
calendar exceptions are confirmed.

## L4 Excel import

The L4 importer is available from **Nieobecności**.

Supported source file:

- worksheet: `RAPORT TBPL`
- columns:
  - `l.p.`
  - `nazwisko i imię pracownika`
  - `rodzaj nieobecności`
  - `data od`
  - `data do`

Workflow:

1. Select Excel file.
2. Parse and validate rows.
3. Show preview.
4. Manually resolve unmatched or ambiguous employee rows when needed.
5. Recheck the resolved rows against duplicates, overlaps and owner-month
   availability.
6. Apply only rows marked ready.
7. Leave unresolved or review-required rows unimported.

Matching is based on the current employee register. The source name is
normalized for case and whitespace and interpreted as surname-first. The system
does not create employees from the L4 file and does not guess partial surname
matches.

If a row is unmatched or ambiguous, the coordinator may select an existing
employee manually in the preview. Manual resolution does not bypass safety
checks: the row is classified again before it can become ready for import.

Preview statuses include ready, duplicate, overlap requiring review, unmatched,
ambiguous, invalid, unsupported type and missing owner month.

Exact active duplicates are skipped. Adjacent, non-overlapping L4 periods are
separate absence documents and are imported without merging or manual review.
Actual date overlaps and non-L4 conflicts require review. Imported absence
documents are stored once under the start month:

```text
months/{startMonthId}/absences/{absenceId}
```

The full absence date range is preserved, including cross-month and
cross-year periods.

Only L4 is supported in this importer. A source value containing `L4` plus any
additional comment, for example `L4 + opieka/szpital`, is treated as L4. Other
absence types stay out of the write set.

## Known limitations

- Ambiguous/unmatched L4 rows can be resolved manually to an existing employee,
  but rows that still require duplicate, overlap or missing-month review remain
  blocked from import.
- Toyota-specific calendar override governance remains open.
- Readiness is an operational guide, not final month closing or payroll
  approval.
