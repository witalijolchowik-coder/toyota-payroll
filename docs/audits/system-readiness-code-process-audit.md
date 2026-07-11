# System Readiness Audit — Code, Architecture and Business Process

Date: 2026-07-11  
Repository under audit: `witalijolchowik-coder/toyota-payroll`  
Local workspace: `C:\Users\vitalii.olkhovyk\Documents\Codex\2026-07-01\you-are-working-in-the-github\work\remote-check`  
Branch checked locally: `main`  
Latest local commit observed: `15ca7c005df0fbffc8a312e47ad789b74e25f97b`  
Remote URL observed: `https://github.com/witalijolchowik-coder/toyota-payroll.git`  
Deployed application URL used for companion live audit: `https://witalijolchowik-coder.github.io/toyota-payroll/`

## 1. Executive summary

Toyota Payroll has moved well beyond a shell: it now contains Firebase Auth with `appUsers` access control, employee management, template-based employee import/update, monthly settlement workspace, manual daily values, absences, adjustments, departments, shifts, payroll settings, entitlement foundations, draft settlement calculations, review state, and export helpers.

The system is not ready for real operational payroll use yet. It is best described as an advanced MVP foundation with several usable data-entry modules and a broad calculation/export draft. The highest-risk issue found during the audit is that the live Monthly Settlement and Absences workflows currently fail to load absence-dependent data, while those workflows are central to monthly settlement. Several other areas are intentionally foundation-only: export generation, report route, month closing, server-authoritative calculation, import engines for attendance/L4, and final payroll approval.

The audit did not change implementation code.

## 2. Overall readiness rating

Readiness rating: **Foundation complete for continued development; not ready for real payroll operation.**

Recommended operational gate:

- Real employee data import: **do not expand real data import yet** until the live absence/month loading blocker is fixed and the pre-import security checklist is completed.
- Operational daily use by a coordinator: **limited pilot only**, if restricted to Employees and Settings-style setup tasks.
- Monthly settlement/export: **not ready**.

## 3. Critical blockers before real operational use

| ID            | Severity | Area                                    | Finding                                                                                                                                                                                                               | Blocks data import | Blocks monthly settlement | Blocks export |
| ------------- | -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | ------------- |
| CODE-CRIT-001 | Critical | Firestore reads / Absences / Settlement | Live app cannot load Monthly Settlement and Absences data in the deployed environment; both pages show Firebase/load errors. The shared code path uses collection-group absence reads via `repositories.allAbsences`. | No                 | Yes                       | Yes           |
| CODE-CRIT-002 | Critical | Calculation authority                   | Monthly settlement calculations are client-side, in-memory drafts. No Cloud Function, persisted settlement snapshot, close/freeze workflow, or server-authoritative recalculation exists.                             | No                 | Yes                       | Yes           |
| CODE-CRIT-003 | Critical | Reports/export workflow                 | Export mapping helpers exist, but the Reports route is still a placeholder and export readiness is warning-only. There is no production export approval/locking flow.                                                 | No                 | Yes                       | Yes           |
| CODE-CRIT-004 | Critical | Data quality gate                       | Real-data readiness checklist exists but is unchecked; live data already contains employees while several modules still fail or are foundation-only.                                                                  | Yes                | Yes                       | Yes           |

## 4. High-priority issues

| ID            | Severity | Area/module                     | Description                                                                                                                                                                                   | Evidence                                                                                                                                                                        | Business impact                                                                             | Recommended action                                                                                                          | Blocks data import | Blocks monthly settlement | Blocks export |
| ------------- | -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | ------------- |
| CODE-HIGH-001 | High     | Firestore Rules / Absence reads | Security rules tests cover many direct writes/reads but do not prove the collection-group absence queries used by the app.                                                                    | `src/services/absencesService.ts` uses `repositories.allAbsences`; `tests/firestore-rules/firestore.rules.test.ts` has direct absence writes but no collection-group read test. | Absences and settlement can fail in production even if CI rules tests pass.                 | Add focused collection-group read tests and adjust rules/indexes only if required.                                          | No                 | Yes                       | Yes           |
| CODE-HIGH-002 | High     | Local repository state          | Local clone is on `main`, but HEAD/status are not a clean mirror of the published API-created commits; many implementation files appear modified/untracked.                                   | `git status --short` shows many implementation files modified/untracked; local HEAD observed as `15ca7c0`.                                                                      | Future commits risk accidentally including implementation files or auditing the wrong base. | Reconcile local Git state with remote main before any remediation branch. Commit only audit docs in this pass.              | No                 | Medium                    | Medium        |
| CODE-HIGH-003 | High     | Access control / roles          | App has roles (`admin`, `coordinator`, `viewer`) in types and rules compatibility, but UI behavior does not yet enforce role-specific capabilities.                                           | `src/types/auth.ts`, `src/services/authService.ts`, `firestore.rules`; UI actions are generally available to any active app user.                                               | A viewer-style account would likely see write controls if Firestore permits active users.   | Define MVP role matrix and enforce both UI capability visibility and Firestore rules.                                       | Yes                | Yes                       | Yes           |
| CODE-HIGH-004 | High     | Audit logging                   | `auditLog` collection/rules/types exist, but most client write paths do not append audit entries.                                                                                             | Services create/update employees, daily values, absences, adjustments, settings without audit writes.                                                                           | Payroll-sensitive changes lack a durable business audit trail.                              | Decide whether audit is Cloud Function-owned or client-owned with transaction discipline; implement before production use.  | Medium             | Yes                       | Yes           |
| CODE-HIGH-005 | High     | TETA uniqueness                 | Active TETA uniqueness is enforced client-side by scanning employees before create/update, but not transactionally/server-authoritatively.                                                    | `src/services/employeesService.ts` calls `getEmployeesForUniquenessCheck()` then `addDoc`/`updateDoc`.                                                                          | Concurrent imports/users can create duplicates.                                             | Add server-side unique index/reservation or deterministic TETA document strategy before multi-user operation.               | Yes                | Medium                    | Medium        |
| CODE-HIGH-006 | High     | Firestore costs/performance     | Settlement loads full employees, employeeEntitlements, departments, dailyValues, payrollSettings, adjustments, reviewStates for a month and absence collection group.                         | `src/services/settlementService.ts`.                                                                                                                                            | Hundreds of employees and multiple years can make month open slow and costly.               | Add query narrowing, indexes, pagination/virtualization, and server pre-aggregation when closing/calculation is introduced. | No                 | Yes                       | Medium        |
| CODE-HIGH-007 | High     | Import/export mojibake risk     | Several source literals rendered in audit shell output as mojibake, while live UI Polish appears mostly correct. This may be console encoding only, but export headers must be byte-verified. | `src/utils/reports/settlementExports.ts` output via PowerShell displayed corrupted Polish labels.                                                                               | Toyota/SOZ files may have incorrect column text if source encoding is not actually UTF-8.   | Verify generated export bytes against supplied Excel/CSV templates in CI with snapshot fixtures.                            | No                 | No                        | Yes           |
| CODE-HIGH-008 | High     | Adjustment UI i18n              | Adjustments page contains visible Polish strings directly in React instead of translation resources.                                                                                          | `src/pages/AdjustmentsPage.tsx` has hardcoded labels/messages.                                                                                                                  | Violates project i18n convention and makes UI consistency/regression harder.                | Move visible strings to `src/i18n/pl.ts`.                                                                                   | No                 | No                        | No            |

## 5. Medium-priority issues

| ID           | Severity | Area/module                          | Description                                                                                                                                      | Evidence                                                                                          | Business impact                                                                  | Recommended action                                                                             | Blocks data import | Blocks monthly settlement | Blocks export |
| ------------ | -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | ------------- |
| CODE-MED-001 | Medium   | Reports route                        | `ReportsPage` remains a `ModulePlaceholder`; export UI exists only inside Monthly Settlement.                                                    | `src/pages/ReportsPage.tsx`.                                                                      | Coordinator may expect reports from navigation but finds placeholder.            | Either hide route until usable or make it a real export/report hub.                            | No                 | No                        | Medium        |
| CODE-MED-002 | Medium   | Month creation dependencies          | Absences and Adjustments require existing month documents but do not provide a create path; only Monthly Settlement creates a month.             | `src/services/absencesService.ts`, `src/services/adjustmentsService.ts`, live empty/error states. | Coordinator must know to create month elsewhere before entering facts.           | Add workflow guidance or month-create CTA in dependent modules.                                | No                 | Medium                    | Medium        |
| CODE-MED-003 | Medium   | Employee form requirement mismatch   | Business import template requires `employment_start`; manual employee form marks TETA/name required but employment start is not marked required. | `src/features/employees/EmployeeFormDialog.tsx`, `employeeValidation.ts`.                         | Missing employment start excludes employee from payroll silently except warning. | Make employment start required for production, or add explicit data-quality blocking workflow. | Yes                | Yes                       | Medium        |
| CODE-MED-004 | Medium   | Identity data quality                | PESEL/passport/foreign document are optional and export warns later; no stronger pre-export data quality workflow exists.                        | Employee model and export warnings.                                                               | SOZ split can fail late.                                                         | Add identity readiness dashboard before import/export.                                         | Medium             | No                        | Yes           |
| CODE-MED-005 | Medium   | Department references                | Employee `department_id` is a plain nullable string; no rule-level referential integrity to an active department.                                | Employee document/rules.                                                                          | Deleted/inactive/renamed departments can produce stale context.                  | Add client validation and later server validation or Cloud Function checks.                    | Medium             | Medium                    | Medium        |
| CODE-MED-006 | Medium   | Effective-dated entitlement overlaps | UI validation warns/blocks some overlap cases, but rules do not prevent overlapping entitlements across documents.                               | `employeeEntitlementValidation.ts`, `firestore.rules`.                                            | Conflicting housing/UDT facts can enter via concurrent clients or legacy data.   | Add transaction/server validation before production.                                           | Medium             | Medium                    | Medium        |
| CODE-MED-007 | Medium   | Public holiday source                | Polish public holidays have helper support, but public holiday database/override governance is not production-complete.                          | `publicHolidays.ts`, calendar foundation docs.                                                    | Nominal hours may be wrong for real payroll months.                              | Implement authoritative Polish holiday set and coordinator overrides.                          | No                 | Yes                       | Yes           |
| CODE-MED-008 | Medium   | Review is informational              | Review statuses exist but do not close, lock, snapshot, or hard-block export.                                                                    | `docs/business-rules/monthly-settlement-review.md`, `SettlementReviewPanel`.                      | Coordinator may believe “checked” means payroll is immutable/ready.              | Add explicit closing/export gate semantics.                                                    | No                 | Yes                       | Yes           |
| CODE-MED-009 | Medium   | Export exactness                     | Toyota export emits Excel XML `.xls`; docs acknowledge exact `.xlsx` styling is not implemented.                                                 | `docs/business-rules/export-formats.md`, `settlementExports.ts`.                                  | Delivered file may not match Toyota template expectations.                       | Validate against supplied sample templates before production.                                  | No                 | No                        | Yes           |
| CODE-MED-010 | Medium   | UI data density                      | Tables render all employee rows and full month grids without virtualization.                                                                     | `EmployeesTable`, `SettlementGrid`, live Employees showed 60 rows.                                | Larger populations may degrade UX.                                               | Add table pagination/virtualization before scaling.                                            | No                 | Medium                    | No            |

## 6. Low-priority improvements

| ID           | Severity | Area/module          | Description                                                                   | Evidence                                                              | Business impact                                     | Recommended action                                             |
| ------------ | -------- | -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| CODE-LOW-001 | Low      | Dashboard            | Dashboard cards still use placeholder values and mixed English/Polish labels. | Live Dashboard headings include placeholder dashes and “Not started”. | Low trust for coordinators.                         | Replace with real readiness cards or label clearly as preview. |
| CODE-LOW-002 | Low      | Navigation labels    | Navigation still has English `Dashboard` and `Reports`.                       | `src/config/navigation.ts`, live app.                                 | Polish UI consistency issue.                        | Move labels to translations and Polish copy.                   |
| CODE-LOW-003 | Low      | Console logging      | Some catch blocks call `console.error`.                                       | Import dialogs and global error boundary.                             | Acceptable for development but noisy in production. | Use structured logging policy later.                           |
| CODE-LOW-004 | Low      | Screenshots/evidence | No automated UI screenshots are committed due personal-data risk.             | Live Employees contains real employee names.                          | Limits visual regression evidence.                  | Add seeded non-production environment for screenshot tests.    |

## 7. Completed and reliable areas

- React + Vite shell, protected routes, app layout, global providers and navigation are present.
- Firebase Auth login and appUsers allowlist are integrated.
- Firestore type/converter boundaries are broad and consistent for current collections.
- Employee register is operational with add/edit/deactivate and template-based import/update.
- TETA is consistently treated as the business identifier in UI/import/export helpers.
- Operational documents store `employee_id` and `teta_number`, not employee names.
- Daily value model correctly preserves imported base facts and stores manual overrides.
- Absence source documents are not duplicated across months; start-month ownership is implemented.
- Payroll foundation helpers cover month ranges, working days, nominal hours, virtual defaults, employment overlap and draft aggregation.
- Tests are extensive for pure helpers and Firestore rules.

## 8. Foundation-only or incomplete areas

| Area                 | Current state                                            | Missing                                                                              | UI suggests usable?                      | Blocks real operation? |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------- |
| Reports              | Placeholder route plus export helper/panel in settlement | Report hub, export history, generated report documents, exact Toyota file validation | Yes, navigation says Reports             | Yes for export process |
| Payroll engine       | In-memory draft helpers                                  | Server-authoritative calculation, persisted snapshot, closing workflow               | Draft panel suggests calculation exists  | Yes                    |
| Calendar constructor | Single-employee range editing and filters                | Scheduling planner, undo/review queue, bulk validation                               | Partly usable                            | Medium                 |
| Departments/shifts   | Department CRUD and employee color shift assignment      | Actual schedules, rotation calendar, historical shift assignment                     | Partly usable                            | Medium                 |
| Entitlements         | Employee entitlement UI and helper resolution            | Import/update templates for entitlements, overlap enforcement in rules               | Partly usable                            | Medium                 |
| Audit log            | Types/rules only                                         | Writes from business operations                                                      | No visible UI                            | High                   |
| Storage/imports      | Paths/rules/types foundation                             | Attendance/L4 import engine, Storage-backed file processing                          | Mostly not visible                       | High                   |
| Month closing        | Not implemented                                          | Settle/close/freeze, snapshot, export gate                                           | Review readiness may imply future export | Critical               |

## 9. End-to-end process findings

### A. Employee onboarding

Required inputs:

- TETA, first name, last name, employment start/end, identity document, department, color shift, housing/UDT entitlement.

Current workflow:

- Manual employee creation exists in `EmployeesPage` and `EmployeeFormDialog`.
- Template import/update exists in `EmployeeTemplateImportDialog` and `employeeTemplateImport.ts`.
- Department assignment and Red/White/Blue shift assignment exist on employee records.
- Housing/UDT are separate employee entitlements in `EmployeeEntitlementsPanel`.

Findings:

- CODE-MED-003: manual employment start is not strongly required even though missing start excludes the employee from payroll.
- CODE-HIGH-005: TETA uniqueness is client-side only.
- CODE-MED-004: SOZ-critical identity data is optional and only warned later.
- The template import correctly avoids payroll facts/hours/absences/bonuses.

### B. Monthly setup

Required inputs:

- Month document, participants by employment overlap, calendar/holidays, departments/shifts/settings.

Current workflow:

- Month selection and explicit month creation exist in Monthly Settlement.
- Participation uses employment overlap, not current `is_active`.
- Settings are global and effective-dated.

Findings:

- Live Monthly Settlement fails to open due data-loading error, likely absence collection-group read/rules/index gap.
- Month creation is centralized in Monthly Settlement; Absences/Adjustments depend on it but do not create it.
- Public holiday/override governance is incomplete.

### C. Work-time data

Current workflow:

- Virtual 8h defaults are not persisted.
- Manual daily values are persisted as `source: manual`.
- Imported attendance base values can be corrected by `manual_override`.
- Work-time correction fields store planned/actual intervals and classification overrides.

Findings:

- Strong model foundation exists.
- Actual attendance import engine is not implemented.
- Work-time classification remains foundation/draft and not final salary logic.

### D. Absences

Current workflow:

- Manual absence CRUD/cancel is implemented.
- Cross-month ownership by start month is implemented.
- Non-L4 over active L4 is blocked client-side/service-side helper.
- Current absence cards exist on Absences page.

Findings:

- Live Absences page shows load error even though dialog can open.
- Rules tests do not prove production collection-group query behavior.
- Absence effects on bonuses/calculation are draft-level and need final confirmation before export.

### E. Monthly components

Current workflow:

- Frequency bonus, transport, laundry, UDT, own housing, company accommodation and manual adjustments are represented in draft helpers.
- Settings are effective-dated.

Findings:

- The implementation is explicitly a read-only aggregation/foundation.
- Some defaults exist in code as fallback amounts. Before production, all payroll settings should be seeded/configured and missing settings should be treated as data quality issues where appropriate.

### F. Review

Current workflow:

- Review states under `/months/{monthId}/reviewStates/{employeeId}`.
- Review panel groups warnings and links to correction areas.

Findings:

- Review readiness is informational only.
- No close/freeze/export gate.
- Live Monthly Settlement failure prevents practical review workflow testing.

### G. Export

Current workflow:

- Pure helpers produce Toyota XML `.xls`, SOZ PL/foreign CSV and overtime/niedoczas note.
- Export panel exists inside Monthly Settlement.

Findings:

- Reports route is placeholder.
- Export is warning-only and not production-gated.
- Exact sample-file compatibility must be verified before real export.

## 10. Data model findings

Collections represented:

- `appUsers`
- `employees`
- `departments`
- `employeeEntitlements`
- `payrollSettings`
- `months`
- `months/{monthId}/employeeSettlements`
- `months/{monthId}/reviewStates`
- `months/{monthId}/dailyValues`
- `months/{monthId}/absences`
- `months/{monthId}/adjustments`
- `months/{monthId}/imports`
- `reports`
- `auditLog`

Integrity notes:

- TETA remains the business key; Firestore employeeId remains internal.
- Employee names are not duplicated into operational documents, which is good.
- Department/entitlement references are soft references without cross-document rule enforcement.
- Daily value IDs are canonical by employee/date.
- Absence records are source documents; daily values do not duplicate absence facts.
- Review states are mutable workflow state, not settlement snapshots.
- Audit log exists but is not populated by normal operations.

## 11. Security findings

Positive findings:

- No public Firestore access.
- Active `appUsers/{uid}` document required for business collections.
- Signed-in but unapproved users are intended to see no-access state.
- appUsers are read-only to self and not client-writable.
- employeeSettlements and reports are client read-only.
- Settled month child writes are denied.
- Imported daily value base facts are protected from browser overwrite.
- Audit log is append-only.

Concerns:

- Role-specific capability enforcement is not implemented.
- Client-side UI shows write controls based mostly on active access, not role.
- `auditLog` is not actually written by normal client operations.
- Collection-group absence read path needs production/rules test coverage.
- No user-management UI or first-user bootstrap tooling is implemented.

## 12. Calculation findings

Consistent foundations:

- Month range and date listing are UTC-based.
- Employee participation uses employment overlap.
- Individual nominal hours use working days inside employment.
- Virtual defaults are separated between UI future display and payroll fallback.
- Manual/imported/imported override daily values are distinguished.
- Absence overlaps and L4 priority are modeled.
- Frequency bonus, transport, laundry, UDT, housing, adjustments, private time, niedoczas and overtime buckets have tests.

Risks:

- Calculation is client-side only and not persisted as authoritative.
- Some fallback amounts are hardcoded in the draft calculation helper.
- Public-holiday data and Toyota-specific overrides are not production-governed.
- Work-time deviations use default planned shift assumptions when detailed schedule data is missing.
- Export values depend on draft calculations that are not closed or frozen.

## 13. Import/export findings

Operational imports:

- Manual employee creation.
- Template-based employee import/update.
- Legacy Toyota/SOZ employee import code remains but is not the normal visible workflow.

Not operational:

- Attendance import.
- Absence/L4 import.
- Payroll fact import.
- Report/export persistence.

Export:

- Toyota and SOZ mapping helpers exist and are tested.
- SOZ split uses identity fields rather than nationality/name inference.
- Missing identity is warned.
- Unsupported columns are warned.
- Export does not close months and does not persist output records.

Recommendation:

- Keep Toyota/SOZ employee import legacy/internal as documented.
- Before production export, compare generated files against the attached real templates and add fixture-based tests.

## 14. Test coverage findings

Strong coverage:

- Firestore converters and path helpers.
- Firestore security rules for many direct collection operations.
- Employee validation, template imports, old employee import foundation.
- Payroll month/date/nominal/virtual defaults.
- Absence rules.
- Attendance effective values and clearing behavior.
- Daily value validation.
- Calendar constructor.
- Payroll settings and adjustment validation.
- Calculation draft components.
- Export helpers.
- Settlement review helpers.

Gaps:

- No end-to-end browser tests.
- No collection-group absence read rules test.
- No production Firebase smoke test in CI.
- No visual regression tests for dense tables/dialogs.
- No test proving real sample Toyota/SOZ files exactly match export/import expectations.
- No multi-user concurrency tests for duplicate TETA or overlapping entitlements.

## 15. Performance findings

Expected concerns with realistic data:

- Employees page uses realtime `onSnapshot` over all employees and renders all rows.
- Settlement loads broad datasets for every month open.
- Absence reads use collection-group queries and client-side filtering.
- Employee uniqueness check scans all employees.
- Entitlement/settings resolution is client-side.
- Monthly grids render many cells and no virtualization is visible.

Recommended performance sequence:

1. Fix production read blocker.
2. Add indexes and tests for planned queries.
3. Add pagination/virtualization for employee and settlement tables.
4. Move authoritative month calculation/export to Cloud Functions or a controlled backend boundary.

## 16. Documentation inconsistencies

- Roadmap still contains earlier step framing and many areas marked foundation/draft; this is accurate but should be kept visible to coordinators/admins.
- `docs/security/pre-import-checklist.md` says real employee import must wait until checklist complete, but live app already contains employee data.
- Some UI navigation labels (`Dashboard`, `Reports`) remain English while the project requires Polish coordinator UI.
- Reports documentation describes export foundation, while the Reports route itself is placeholder.

## 17. Recommended implementation sequence

1. **Fix live absence/month loading blocker** and add collection-group rules/index tests.
2. **Reconcile local repository state** so future commits are clean and based on actual remote main.
3. **Complete pre-import security checklist** with approved users, rejected users, and role expectations.
4. **Data quality hardening**: employment start required, identity readiness, department/shift/entitlement validation.
5. **Month operational readiness**: create-month guidance from dependent modules, public holidays/overrides, no missing settings.
6. **Server-authoritative calculation and closing**: persisted settlement snapshot and immutable close flow.
7. **Production export validation** against real Toyota/SOZ samples.
8. **Performance/UX hardening** for larger employee/month datasets.

## 18. Questions requiring business clarification

1. Should every active app user be able to edit all payroll data during MVP, or do we need immediate `admin`/`coordinator`/`viewer` behavior?
2. Should missing employment start block employee creation/update now?
3. What is the official source for Polish public holidays and Toyota-specific calendar overrides?
4. Are fallback payroll amounts acceptable during pilot, or must missing settings block review/export?
5. What exact approval action should convert review status into an immutable monthly settlement?
6. Should export be allowed with warnings, or must warnings hard-block export?
7. Which user or system owns audit log creation: browser transaction, Cloud Function, or future backend process?
