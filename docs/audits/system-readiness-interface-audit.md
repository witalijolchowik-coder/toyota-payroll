# System Readiness Audit — Live Interface and Coordinator Workflow

Date: 2026-07-11  
Live application: `https://witalijolchowik-coder.github.io/toyota-payroll/`  
Authentication: Firebase email/password login tested with user-supplied credentials. Credentials are not recorded in this report.  
Screenshots: no screenshots are committed because the live application contains real employee names and payroll-adjacent data. Evidence below uses sanitized observations.

## 1. Executive summary

The live application is reachable and login succeeds. The app shell, protected routes, logout, Employees page, Settings page, dialogs, navigation, and basic responsive behavior are visible and mostly coherent.

The live interface is not ready for coordinator production use. The two most important operational screens — Monthly Settlement and Absences — currently show load errors. Employees is the most usable module and already contains real employee rows. Settings, Adjustments, and import dialogs are present, but parts of the workflow depend on missing month/setup data. Reports remains a placeholder.

## 2. Overall interface readiness rating

Interface readiness rating: **Setup/pilot-ready for employee register review; not ready for monthly payroll operation.**

## 3. Pages/routes inspected

| Route                  | Status observed                                                                                   | Classification                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| `#/login`              | Login screen renders and accepts credentials.                                                     | Usable                           |
| `#/dashboard`          | Renders placeholder cards and navigation.                                                         | Foundation/demo only             |
| `#/employees`          | Renders employee list, filters, import button, add/edit/deactivate actions, entitlements section. | Usable with limitations          |
| `#/monthly-settlement` | Shows page header and month selector but fails to open month/data.                                | Broken for current live workflow |
| `#/absences`           | Shows page header, summary cards and add dialog, but page shows load error.                       | Broken for current live workflow |
| `#/adjustments`        | Renders month selector, table, add dialog; no rows for selected month.                            | Usable with limitations          |
| `#/reports`            | Shows placeholder “Workspace ready”.                                                              | Placeholder                      |
| `#/settings`           | Renders payroll settings/departments area and add dialogs.                                        | Usable with limitations          |
| Unknown route          | Not explicitly tested visually; source has `NotFoundPage`.                                        | Not tested                       |

## 4. Scenarios tested

Safe scenarios executed:

- Open live GitHub Pages deployment.
- Inspect login screen.
- Login with user-supplied credentials.
- Open Dashboard.
- Open Employees page.
- Inspect employee add dialog without saving.
- Inspect employee template import/update dialog without uploading.
- Open Monthly Settlement page.
- Open Absences page.
- Inspect absence add dialog without saving.
- Open Adjustments page.
- Inspect adjustment add dialog without saving.
- Open Reports page.
- Open Settings page.
- Inspect payroll setting add dialog without saving.
- Inspect department add dialog without saving.
- Refresh an authenticated protected route.
- Logout.
- Attempt direct protected route after logout.
- Inspect desktop/laptop/tablet/mobile viewport behavior.
- Inspect browser console errors/warnings after navigation; none were captured by the browser log API during the final read.

## 5. Scenarios not tested and why

- Invalid credentials behavior: not executed to avoid unnecessary authentication churn in the real Firebase project.
- Creating, editing, deactivating real employees: not executed because the live data appears to contain real employee records.
- Creating months, absences, adjustments, settings or departments: not executed because this audit is non-destructive and no explicit temporary-record authorization was given.
- Uploading import files: not executed to avoid creating preview/apply side effects against real data.
- Editing daily values/review states/export download: Monthly Settlement did not load successfully.
- No-access state for a different unapproved account: not safely testable without a second unapproved credential.

## 6. Critical usability blockers

| ID          | Severity | Page/component     | Description                                                  | Evidence                                                               | Coordinator impact                                                                            | Recommended action                                                  | Blocks operational use   |
| ----------- | -------- | ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ |
| UI-CRIT-001 | Critical | Monthly Settlement | Page cannot open the selected month/data and shows an error. | Live `#/monthly-settlement` alert: “Nie udało się otworzyć miesiąca…”. | Coordinator cannot review monthly grid, daily values, drafts, review, or export.              | Fix underlying Firebase/rules/query/index issue and add smoke test. | Yes                      |
| UI-CRIT-002 | Critical | Absences           | Page cannot load absences and shows an error.                | Live `#/absences` alert: “Nie udało się pobrać nieobecności…”.         | Coordinator cannot reliably manage absence records, which are source-of-truth for settlement. | Fix absence loading path and test collection-group queries.         | Yes                      |
| UI-CRIT-003 | Critical | Reports            | Reports route is only a placeholder.                         | Live `#/reports` headings include “Workspace ready”.                   | Coordinator has no standalone reporting/export workspace.                                     | Hide route or implement real report/export hub.                     | Yes for reporting/export |

## 7. Incomplete/disabled/placeholder functionality

| ID          | Severity | Page/component   | Description                                                                                                      | Evidence                                                                          | Coordinator impact                                                       | Recommended action                                              |
| ----------- | -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| UI-HIGH-001 | High     | Dashboard        | Dashboard shows placeholder cards and mixed English/Polish labels.                                               | Live Dashboard headings include placeholder values and “Not started”.             | It does not guide the coordinator to next actions.                       | Replace with setup/readiness cards or label clearly as preview. |
| UI-HIGH-002 | High     | Monthly workflow | There is no visible end-to-end workflow progress from setup → data entry → review → export.                      | Navigation is module-based; review/export only appear after monthly screen loads. | Coordinator may not know what must be completed first.                   | Add monthly workflow checklist/readiness panel.                 |
| UI-HIGH-003 | High     | Adjustments      | Page can open and dialog exists, but add button depends on existing month and employees.                         | Live page selected previous month and empty state.                                | If month missing, coordinator must know to create it elsewhere.          | Add CTA/link to create month in Monthly Settlement.             |
| UI-MED-001  | Medium   | Employees        | Employee table has many action icons and dense rows; mobile view is technically responsive but not comfortable.  | Live Employees had 60 rows; mobile width still rendered dense tables/actions.     | Usable on desktop, poor on narrow devices.                               | Add pagination/virtualization and mobile-friendly row details.  |
| UI-MED-002  | Medium   | Settings         | Empty states for payroll settings/departments are visible but do not explain required minimum setup for payroll. | Live Settings shows “Brak ustawień płacowych” and “Brak działów”.                 | Coordinator may not know which settings are mandatory before settlement. | Add required setup checklist.                                   |
| UI-MED-003  | Medium   | Import dialog    | Template import dialog is understandable, but no sample preview was tested and file errors were not exercised.   | Dialog exposes template tabs and `__CLEAR__` explanation.                         | Likely usable, but needs real file validation UX check.                  | Test with sanitized CSV fixtures in staging.                    |

## 8. Page-by-page findings

### Login

- Fully renders Polish login card.
- User-supplied credential login reached `#/dashboard`.
- Logout returned to `#/login`.
- Direct navigation to `#/employees` after logout redirected to `#/login`.
- Session persisted across refresh on protected route.

Finding:

- UI-LOW-001: login copy is clear, but there is no password reset/help path yet. This matches documentation but should be visible to admins.

### Dashboard

- Renders shell and cards.
- Still reads like a placeholder/demo area.
- Mixed English labels are visible (`Dashboard`, `Latest Imports`, `Payroll Status`, `Not started`).

Finding:

- UI-HIGH-001: Dashboard does not yet support coordinator decision-making.

### Employees

- Employee list loads successfully and shows 60 rows in the live environment.
- Search/status controls are present.
- Add employee dialog contains TETA, name, identity, department, shift, start/end dates.
- Template import/update dialog is the visible import workflow and explains that Toyota/SOZ files are not the standard employee import.
- Entitlements panel is visible.

Findings:

- UI-MED-004: Employees is the strongest operational page, but dense row/action layout may be hard at scale.
- UI-MED-005: Employment start is visible but not strongly signaled as payroll-critical in the add dialog.

### Monthly Settlement

- Header and month selector render.
- Live data load fails.
- No grid/review/export could be visually tested on live.

Finding:

- UI-CRIT-001 blocks coordinator settlement workflow.

### Absences

- Header, month filter, current absence cards and add dialog render.
- Live data load fails.
- Add dialog contains employee, absence type, date range and note.

Finding:

- UI-CRIT-002 blocks absence workflow.

### Adjustments

- Month selector, table headers and add dialog render.
- Add dialog preselects an employee and category/direction fields.
- Visible strings are mostly Polish, but this page contains hardcoded UI copy in code rather than i18n resources.

Finding:

- UI-MED-006: Add/edit appears usable only after month exists; missing-month guidance exists as alert but no create action.

### Reports

- Placeholder route only.

Finding:

- UI-CRIT-003 blocks report workflow.

### Settings

- Payroll settings and departments sections render.
- Add setting and add department dialogs open.
- Empty state is clear but does not specify minimum required settings.

Finding:

- UI-MED-002: setup requirements need to become explicit before real payroll use.

## 9. Coordinator workflow findings

The interface does not yet present a clear operational work order. A coordinator can discover modules through navigation, but the system does not yet answer:

1. Which employees are missing payroll-critical data?
2. Which month must be created first?
3. Which settings are missing for the selected month?
4. Which absences/hours/reviews block export?
5. What is the next correction action?

The review panel may eventually provide this, but it could not be tested live because Monthly Settlement failed to load.

## 10. Visual consistency findings

Positive:

- Material UI theme is consistent.
- Main app shell is clean.
- Dialogs generally have clear titles and action buttons.
- Tables use predictable headers.
- Drawer collapse/hamburger behavior works at smaller widths.

Concerns:

- Mixed English/Polish labels remain on Dashboard/Reports.
- Very dense employee/action tables on small screens.
- Some dialogs expose many fields without a “required for payroll/export” grouping.
- Empty states are visually clean but sometimes not instructional enough.

## 11. Responsive findings

Viewports inspected:

- 1366×768 desktop
- 1024×768 smaller laptop
- 768×900 tablet
- 390×844 narrow/mobile

Observed:

- Desktop/laptop layout works.
- Drawer becomes hamburger on tablet/mobile.
- No broad page-level horizontal overflow was detected in the sanitized DOM checks.
- Employee tables remain dense and action-heavy on narrow width.
- Monthly grid could not be tested because it did not load.

Recommendation:

- Treat mobile as read-only/triage-friendly unless a dedicated mobile table/card layout is added.

## 12. Accessibility findings

Positive:

- Many buttons have accessible labels.
- Login fields are visible and typed correctly.
- Dialogs use standard MUI dialog structure.

Concerns:

- Icon-heavy employee table may be noisy for screen readers because each row has repeated edit/deactivate labels.
- Dense tables need keyboard/focus review with real data.
- Mobile/narrow table usability is weak.
- Some select-like controls from MUI did not expose simple label lookup during automation, suggesting practical accessibility should be manually checked.

## 13. Runtime/console findings

- Browser console log API returned no final error/warning entries during the final check.
- However, the UI displayed Firebase/load errors on Monthly Settlement and Absences. Those are handled errors, not necessarily uncaught console exceptions.

## 14. Recommended interface improvements

1. Fix Monthly Settlement and Absences load errors.
2. Add a coordinator workflow checklist/readiness dashboard.
3. Hide or complete Reports route.
4. Add setup guidance for payroll settings/departments/identity readiness.
5. Add direct links from missing-month alerts to month creation.
6. Add pagination/virtualization and possibly row detail drawers for Employees.
7. Move remaining hardcoded UI labels to translation resources.
8. Add staging/demo data for safe screenshots and UI regression testing.

## 15. Recommended implementation sequence

1. Production read blocker: absences/monthly settlement.
2. Pre-import security checklist completion.
3. Coordinator setup dashboard/readiness indicators.
4. Data-quality warnings with direct correction links.
5. Month close/export workflow.
6. Responsive/table hardening.

## 16. Evidence references

Sanitized observations:

- Login route reached `#/dashboard` after successful authentication.
- Protected `#/employees` route persisted after refresh.
- Logout returned to `#/login`.
- Direct protected route after logout redirected to `#/login`.
- Employees page rendered 60 table rows.
- Monthly Settlement showed a load alert.
- Absences showed a load alert.
- Reports showed placeholder state.
- Settings dialogs opened without saving.
- Responsive checks were performed at four viewport widths.

No screenshots were committed because the live app contains real employee names and payroll-adjacent data.
