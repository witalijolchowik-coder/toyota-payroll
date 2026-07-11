# Approved implementation roadmap

| Step | Scope                                                               | Status      |
| ---- | ------------------------------------------------------------------- | ----------- |
| 1    | Project bootstrap, Firebase boundaries, GitHub Pages, documentation | Complete    |
| 2    | Responsive application shell and module placeholders                | Complete    |
| 3    | Firestore foundation and security-rule tests                        | Complete    |
| 4    | Employees                                                           | Complete    |
| 5    | Month initialization and settlement shell                           | Complete    |
| 6    | Daily value entry                                                   | Complete    |
| 7    | Absences                                                            | Complete    |
| 8    | Recalculation function                                              | Not started |
| 9    | Adjustments                                                         | Complete    |
| 10   | L4 and attendance import                                            | Partial     |
| 11   | Reports                                                             | Not started |
| 12   | Month settlement and usability polish                               | Not started |

Business Rules Block 7 introduced departments, Red/White/Blue employee shift
assignment and a conservative weekly rotation foundation. This is complete as
coordination/filtering context only; it does not implement payroll consequences
or a full schedule planner.

Business Rules Block 8 introduced the foundation for planned-vs-actual work
time, private time, overtime 50%, overtime 100%, public-holiday eligibility and
monthly balancing. This remains a draft/foundation layer only; it does not
calculate final salary amounts or close payroll.

The Firestore-foundation sequencing amendment was approved on 2026-07-02. The
repository must not proceed to Step 4 without explicit approval.

The Step 4 scope was explicitly approved as the Employees module on
2026-07-02. A dedicated authentication experience remains deferred; employee
writes require an existing Firebase Authentication session.

The Step 5 scope was explicitly approved as month initialization and the
read-only settlement shell on 2026-07-02. A dedicated authentication
experience remains deferred; month access requires an existing Firebase
Authentication session.

## Step 1 acceptance criteria

- Local development server starts.
- Static production bundle builds.
- Firebase SDK initializes against the existing project when the API key is supplied.
- Firestore, Storage, Auth, Functions, and emulator boundaries are configured.
- Pushes to `main` can deploy to GitHub Pages.
- No business module or payroll logic exists.

## Step 2 acceptance criteria

- Responsive top bar, collapsible navigation, and main content layout.
- Routes and placeholders for every planned MVP module.
- Shared theme, loading, notification, error, and authentication providers.
- Protected route boundary with temporary authenticated shell state.
- No Firestore reads, writes, or business calculations.

## Step 3 acceptance criteria

- Typed document and domain contracts for every approved MVP collection.
- Runtime-validating converters, domain mappers, canonical paths, and typed
  repository boundaries.
- No anonymous access, no client writes to calculated snapshots or reports,
  and no child writes beneath settled months.
- Append-only audit log and pipeline-owned field protection.
- Converter, helper, and emulator-backed Security Rules tests.
- No production data, business screens, or payroll calculations.

## Step 4 acceptance criteria

- Polish employee register backed by the typed Step 3 Firestore boundaries.
- Create, edit, deactivate, search, and active-status filtering.
- Required-field validation and active-TETA uniqueness preflight checks.
- No employee deletion, payroll calculations, or writes to operational
  documents.
- Unit tests for employee validation and TETA uniqueness plus emulator-backed
  employee Security Rules tests.

## Step 5 acceptance criteria

- Polish month selector with transactional creation of missing canonical month
  documents.
- Read-only calendar grid with TETA and employee names in leading columns.
- Employee participation based on employment-date overlap, never current
  `is_active`.
- Weekend, public-holiday placeholder, and future-day presentation states.
- Virtual `8h` display without persisted default documents.
- Settled-month read-only banner and focused unit and Security Rules tests.

## Step 6 acceptance criteria

- Polish manual-hours editor integrated with eligible monthly-grid cells.
- Explicit manual create and update with canonical IDs and modification
  metadata.
- Clearing or restoring a virtual default deletes only the manual document.
- Distinct virtual, manual, imported, non-working, future,
  outside-employment, and settled states.
- Numeric validation from `0` through `24`.
- Unit and emulator-backed Security Rules tests for create, update, and clear.
- No nominal-hours, bonus, absence, or payroll-engine logic before a separate
  approved Business Rules Specification.

## Step 7 acceptance criteria

- Polish Absences workspace with month, employee, type, and lifecycle filters.
- Manual create, edit, and cancellation; no client deletion.
- One source record per document, owned by the month of `start_date`.
- Cross-month collection-group reads and read-only absence codes in settlement
  cells.
- ACTIVE L4 client-side overlap blocking and pure day-by-day priority helpers.
- Employment-period warnings and current-day summary cards.
- No payroll amounts, imports, reports, ZUS integration, or server-side
  overlap enforcement.

## Business Rules Block 3 implementation

- One canonical DailyValue document per employee-day.
- Imported base facts remain immutable to the browser.
- Audited manual overrides preserve and restore the original imported value.
- Effective-value precedence and attendance warning states are reusable pure
  helpers.
- Absence conflicts, non-working-day facts, and outside-employment facts are
  visible without introducing payroll consequences.
- No import engine, payroll aggregation, or overtime calculation.

## Business Rules Block 4 implementation

- Append-only global payroll setting versions with month-based effective-date
  resolution.
- Initial keys for frequency, transport, accommodation, and UDT amounts.
- Accommodation type variants without employee assignment.
- Reusable full-month, L4-record, and NN frequency-bonus helper.
- Monthly ACTIVE/CANCELLED employee adjustments with open-month editing.
- No payroll aggregation or allowance/deduction calculations.

## Business Rules Block 5 implementation

- In-memory payroll-engine foundation for employee-month calculation drafts.
- Reuses existing employment, calendar, virtual-default, attendance, absence,
  settings, frequency-bonus, and adjustment helpers.
- Produces safe draft totals, warnings, absence grouping, and adjustment
  breakdowns without persisting authoritative payroll results.
- Adds a read-only verification panel in Monthly Settlement.
- No final salary, payroll closing, reports, exports, import engine, overtime,
  transport, accommodation, UDT, tax, ZUS, or Cloud Functions.

## Business Rules Block 6 implementation

- Calendar Constructor added as a visual planning and correction layer over
  existing `DailyValue` and `Absence` documents.
- Single-employee continuous range selection supports hours, L4, UW, UZ, NN,
  and manual-attendance clearing.
- Employee-focused calendar dialog provides detailed daily review and
  daily-hour editing.
- Settled months remain read-only and outside-employment writes are blocked.
- Department/shift filtering and multi-row painting remain deferred because the
  required data and review workflow are not yet modeled.

## Business Rules Block 8 implementation

- Optional `DailyValue.work_time_correction` stores planned shift and actual
  start/end time without replacing imported attendance facts.
- Pure helpers derive normal work, czas prywatny, overtime 50%, overtime 100%,
  public-holiday bonus eligibility and monthly coverage.
- Monthly balancing covers private time and explicitly coverable NI before
  leaving paid overtime.
- Employee day editor can capture actual start/end correction.
- Payroll draft displays work-time foundation totals.
- No final salary calculation, closing, reports, exports, import engine,
  automatic scheduler or full classification-override UI.

## Business Rules Block 9 implementation

- Monthly Settlement now aggregates practical coordinator-facing components per
  employee.
- Work-time and absence results remain hour quantities and are not multiplied
  by hourly rates.
- Brutto additions, the netto transport allowance, and deductions are separated
  to avoid presenting a false net salary.
- Absence periods remain continuous source periods while settlement hours count
  only working days inside the selected month and employment period.
- Holiday bonus, transport, laundry, UDT, own-housing and company-housing
  foundations are calculated from approved rules and payroll settings where
  model data exists.
- UDT and housing production eligibility/assignment remain future data-model
  work; no fake inference from department or shift is used.
- No ZUS, PIT, taxes, net salary, payslip, reports, payroll closing or final
  immutable settlement snapshot.

## Business Rules Block 10 implementation

- Adds effective-dated employee-level entitlements and assignments for UDT,
  own housing allowance, and company accommodation.
- Uses a top-level `employeeEntitlements` collection with `employee_id` and
  `teta_number`; employee names are not duplicated.
- Employees workspace includes a practical `Uprawnienia i przypisania` panel
  with add, period edit, cancellation and history view.
- Monthly Settlement resolves components from real entitlement/assignment
  data instead of placeholder booleans or department/shift inference.
- Company accommodation requires an accommodation variant and warns when the
  variant setting is missing.
- Own housing and company accommodation overlap is blocked in the browser and
  surfaced as a resolver warning.
- No ZUS, PIT, taxes, net salary, payslip, reports, payroll closing or final
  immutable settlement snapshot.

## Business Rules Block 11 implementation

- Adds persisted employee-month review state under
  `/months/{monthId}/reviewStates/{employeeId}`.
- Introduces review statuses: Robocze, Wymaga sprawdzenia, Wymaga korekty,
  Sprawdzone.
- Monthly Settlement includes a review panel with readiness counters, per
  employee status, warning counts and component summaries.
- Employee review details group warnings into practical correction areas and
  provide shortcuts to existing correction modules.
- Readiness is informational only and does not export, close, settle or freeze
  payroll data.
- Review state does not affect settlement calculations.
- No ZUS, PIT, taxes, net salary, payslip, reports, import engine, payroll
  closing or final immutable settlement snapshot.

## Business Rules Block 17 implementation

- Pulpit includes a Firestore-backed readiness view for a selected payroll
  month.
- Readiness distinguishes blocking, warning, optional and informational issues.
- Employee readiness covers missing employment start, identity data,
  department, shift, unresolved `NA0`, inactive/missing departments and
  entitlement conflicts.
- Payroll settings readiness flags missing active settings and overlapping
  effective periods for existing payroll-setting keys.
- Calendar readiness explicitly warns that Toyota-specific calendar overrides
  are not yet production-governed.
- Nieobecności includes preview-first L4 Excel import for the operational
  `RAPORT TBPL` worksheet and required columns.
- Imported L4 documents are stored once under the owner month of `start_date`
  with `source: absence_import`; exact duplicates are skipped and overlaps or
  possible continuations require review.
- Attendance import, final month close, server-authoritative payroll, taxes,
  payslips and multi-user approvals remain out of scope.
