# Changelog

All notable changes to Toyota Payroll are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Development and contribution guidelines.
- Responsive Material UI application shell with top bar, collapsible desktop
  navigation, mobile drawer, and main workspace.
- Routes and placeholders for Dashboard, Employees, Monthly Settlement,
  Absences, Adjustments, Reports, and Settings.
- Global theme, loading, notification, authentication, and error-boundary
  providers.
- Protected route boundary with a temporary authenticated shell identity.
- Dashboard placeholder cards for future operational widgets.
- Firebase Auth and Firestore service boundaries without data access.
- Typed Firestore document and domain models for all MVP collections.
- Runtime-validating Firestore converters, domain mappers, canonical path
  helpers, and typed repository boundaries.
- Emulator-backed Firestore Security Rules tests using synthetic data.
- Polish Firestore-backed employee register with create, edit, deactivate,
  search, and status-filtering workflows.
- Employee input validation and active-TETA uniqueness preflight checks.
- Typed Polish translation resources for the Employees module.
- Polish month selector and read-only monthly settlement calendar.
- Transactional initialization of canonical month documents.
- Employment-overlap population filtering and presentation-only daily defaults.
- Calendar classification for working days, weekends, future dates, and a
  public-holiday provider boundary.
- Polish manual daily-hours editor with create, update, and clear workflows.
- Distinct virtual, manual, imported, non-working, future,
  outside-employment, and settled cell states.
- Daily-hours validation and virtual-default mutation planning.
- Pure payroll-month, working-calendar, employment-overlap, nominal-hours, and
  virtual-default foundation utilities.
- Effective public-holiday and calendar-override inputs for future payroll
  orchestration.
- Polish Absences workspace with manual create, edit, cancellation, filters,
  employment-period warnings, and current-day summary cards.
- Pure absence validation, overlap, L4 priority, governing-day, and employment
  boundary helpers.
- Cross-month absence collection-group reads and read-only absence rendering
  in the monthly settlement grid.
- Attendance precedence and warning helpers for imported overrides, absence
  conflicts, non-working days, and facts outside employment.
- Audited manual corrections that preserve original imported attendance
  values in one canonical employee-day document.
- Append-only global payroll setting versions with effective-month resolution
  and accommodation-type variants.
- Reusable frequency-bonus helper for full-month employment, L4 records, and
  NN disqualification.
- Polish Payroll Settings and Employee Adjustments workspaces.
- ACTIVE/CANCELLED monthly adjustment lifecycle with non-negative amounts.

### Changed

- Updated the implementation roadmap to include the approved application-shell
  step before authentication.
- Updated the implementation sequence so the approved Firestore foundation is
  Step 3 and authentication follows as Step 4.
- Distinguished current employee HR status from historical payroll-period
  participation and locked monthly inclusion to employment-date overlap.
- Added canonical UTC month boundaries and numeric calculation version zero to
  newly initialized month documents.
- Changed the settlement default to the previous month and made month creation
  an explicit coordinator action instead of a page-load side effect.
- Replaced technical Firebase configuration wording with coordinator-friendly
  Polish copy.
- Displayed non-working-day `0h` alongside working-day `8h` as virtual,
  non-persisted defaults.
- Added ACTIVE/CANCELLED absence lifecycle and start-month ownership without
  duplicating cross-month records.
- Extended settlement cells to show imported overrides and explicit-hours
  warnings without introducing payroll consequences.

### Security

- Denied anonymous Firestore access and all client writes to calculated
  settlements, reports, and pipeline-owned fields.
- Enforced read-only settled months and append-only audit entries.
- Restricted client daily values and absences to explicit manual facts; virtual
  defaults and imported pipeline records cannot be written by the client.
- Verified employee create, update, and deactivation permissions while keeping
  employee deletion and metadata spoofing denied.
- Restricted browser month creation to canonical boundaries, an open state,
  caller-bound metadata, and calculation version zero.
- Allowed narrowly scoped `manual_override` updates on imported daily values
  while keeping all imported base fields client-immutable.
- Enforced canonical manual daily-value IDs and kept imported and settled
  values read-only.
- Denied absence deletion, non-canonical owner months, invalid lifecycle
  creation, and mutation after cancellation.
- Kept payroll setting versions append-only and denied adjustment deletion,
  negative amounts, invalid category-direction pairs, and settled-month
  changes.

## [0.1.0] - 2026-07-02

### Added

- React, Vite, and TypeScript application shell.
- Firebase Authentication, Firestore, Storage, Functions, and emulator
  configuration.
- Initial Firestore and Storage security rules.
- GitHub Pages deployment through GitHub Actions.
- Architecture, data-model, decision, and implementation-roadmap
  documentation.
- Formatting, linting, type checking, unit testing, and production-build
  quality gates.

### Fixed

- Allowed the required `@firebase/util`, `protobufjs`, and `re2` dependency
  build scripts in pnpm CI.
- Enabled GitHub Pages for workflow-based deployment.

### Security

- Denied anonymous Firestore and Storage access by default.
- Kept local environment files and credentials outside version control.

[Unreleased]: https://github.com/witalijolchowik-coder/toyota-payroll/compare/821334e1cc2546d90fd6d3fd2925bed42ea3b9cf...HEAD
[0.1.0]: https://github.com/witalijolchowik-coder/toyota-payroll/tree/821334e1cc2546d90fd6d3fd2925bed42ea3b9cf
