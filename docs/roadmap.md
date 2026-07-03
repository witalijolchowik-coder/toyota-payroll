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
| 9    | Adjustments                                                         | Not started |
| 10   | L4 and attendance import                                            | Not started |
| 11   | Reports                                                             | Not started |
| 12   | Month settlement and usability polish                               | Not started |

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
