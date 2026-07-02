# Contributing

Thank you for contributing to Toyota Payroll. This project handles
payroll-adjacent data, so correctness, traceability, and small reviewable
changes take priority over delivery speed.

## Source of truth

Before implementing a feature, read:

- [MVP architecture](docs/architecture/mvp-architecture.md)
- [Platform decisions](docs/architecture/platform.md)
- [MVP data model](docs/architecture/data-model.md)
- [Implementation roadmap](docs/roadmap.md)
- [Architecture decisions](docs/decisions/)

When documents conflict, follow the authority order in
[the documentation index](docs/README.md).

## Scope and approval

- Work only on the currently approved roadmap step.
- Do not begin the next step without explicit approval.
- Do not introduce deferred business modules as placeholders.
- Keep pull requests focused on one feature, fix, or infrastructure concern.
- Record newly discovered architectural decisions as an ADR before relying on
  them across modules.

## Prerequisites

- Node.js 22 or newer
- pnpm 11
- Access to the Firebase project `toyota-payroll`

Do not install project tools globally. Use the versions declared in
`package.json`, `pnpm-lock.yaml`, and the workspace configuration.

## Local setup

```shell
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local` and provide the Firebase web API key.
Never commit `.env.local`.

Start the local application when the environment supports it:

```shell
pnpm dev
```

In constrained Codex environments, a `spawn EPERM` failure from Vite or a
development server is a sandbox limitation, not automatically an application
defect. Do not repeatedly retry it. Verify with the quality and build commands
below and use GitHub Actions as the final Pages-build authority.

## Branches and commits

1. Start from an up-to-date `main`.
2. Create a short, focused branch.
3. Use an imperative commit subject that describes the outcome.
4. Do not mix formatting-only, dependency, infrastructure, and feature changes
   unless they are inseparable.
5. Never rewrite shared branch history.

## Architecture boundaries

- Route-level composition belongs in `src/pages`.
- Feature-specific UI and state belong in `src/features/<feature>`.
- Shared presentation components belong in `src/components`.
- Firebase SDK access belongs behind typed functions in `src/services`.
- Business calculations belong in pure, testable modules—not React
  components.
- Multi-document, sensitive, or long-running operations belong in Cloud
  Functions.
- Firebase configuration belongs in `src/config`; secrets do not.
- Firestore documents use `employee_id` internally and `teta_number` as the
  business identifier. Do not mix these identities.

## Data and security rules

- Treat Firestore and Storage rules as production code.
- Deny access by default and grant only the minimum required permissions.
- Client-side validation never replaces Security Rules or server-side
  validation.
- Do not commit service-account files, tokens, production exports, employee
  data, or payroll data.
- Use synthetic or anonymized fixtures in tests.
- Preserve settled-period protection in both Security Rules and future Admin
  SDK code.

## Dependencies

- Use pnpm; do not switch package managers without an approved architectural
  reason.
- Commit `pnpm-lock.yaml` with dependency changes.
- Do not approve dependency build scripts broadly. Add exact packages to
  `allowBuilds` only after reviewing why their scripts are required.
- Avoid adding a dependency when a small, well-tested local implementation is
  clearer.

## Required checks

Run before requesting review:

```shell
pnpm check
pnpm build
pnpm build:functions
```

`pnpm check` runs formatting validation, ESLint, TypeScript, and unit tests.
Every behavior change requires a test at the lowest practical level.

GitHub Actions must pass before merging. Warnings should be explained in the
pull request when they cannot be removed in scope.

## Changelog

Update `CHANGELOG.md` under `[Unreleased]` for user-visible, architectural,
security, deployment, or developer-workflow changes. Use the headings `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security` as appropriate.

Pure refactoring with no observable impact does not require a changelog entry.

## Pull request checklist

- [ ] The change belongs to the approved roadmap step.
- [ ] Architecture and Firebase boundaries are preserved.
- [ ] Tests cover the changed behavior.
- [ ] `pnpm check`, `pnpm build`, and `pnpm build:functions` pass.
- [ ] Security Rules were tested when changed.
- [ ] Documentation and `CHANGELOG.md` are updated when required.
- [ ] No secrets, personal data, generated builds, or local environment files
      are committed.
