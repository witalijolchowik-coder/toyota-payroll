# Core operational readiness remediation

This note records the remediation pass after the system readiness audit.

## Scope

The remediation focused on making the existing MVP workflows usable in the live
application before new business blocks continue:

- monthly settlement page loading and table usability;
- absences workspace loading and month-state guidance;
- removal of misleading placeholder pages;
- employee data-quality enforcement for new records;
- browser-level verification of the affected workflows.

No payroll amount calculation, imports, report generation history or new payroll
business rules were introduced.

## Root cause addressed

The absences workflow depended on broad collection-group reads during normal page
load. In production this made the page sensitive to collection-group index
availability and caused the coordinator-facing workspace to fail instead of
loading the selected month.

The remediation now reads absence documents from the month-owned subcollections
that can overlap the displayed period. Cross-month absences remain stored once
under the start month, while display/evaluation reads include the neighbouring
owner month needed by the selected payroll month.

## Behaviour after remediation

- Monthly settlement continues to read the selected month and now displays a more
  compact grid.
- The settlement grid no longer exposes a separate TETA column. The leading
  employee column shows employee name, department and shift.
- Absences show a clear warning when the selected month has not been created yet
  and route the coordinator to monthly settlement to create the month.
- Absence dashboard cards remain in the Absences workspace.
- Dashboard and Reports pages now describe real operational readiness and current
  export entry points instead of showing generic placeholders.
- New employee validation requires `employment_start`; legacy records without it
  remain visible as data-quality issues rather than being silently normalised.

## Firestore/index note

The production page-load path no longer requires the broad collection-group
absence query. The Firestore index configuration also documents the collection
group fields needed for remaining and future collection-group usage.

## Deferred items

The following items remain intentionally outside this remediation block:

- server-side role matrix and multi-user approval flows;
- immutable month close;
- server-authoritative payroll calculation;
- full audit log hardening;
- attendance/L4 import automation;
- rotation planner;
- report history;
- tax, ZUS and payslip logic.
