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

### Changed

- Updated the implementation roadmap to include the approved application-shell
  step before authentication.
- Updated the implementation sequence so the approved Firestore foundation is
  Step 3 and authentication follows as Step 4.

### Security

- Denied anonymous Firestore access and all client writes to calculated
  settlements, reports, and pipeline-owned fields.
- Enforced read-only settled months and append-only audit entries.
- Restricted client daily values and absences to explicit manual facts; virtual
  defaults and imported pipeline records cannot be written by the client.
- Verified employee create, update, and deactivation permissions while keeping
  employee deletion and metadata spoofing denied.

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
