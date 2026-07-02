# ADR 0001: Bootstrap stack

- Status: Accepted
- Date: 2026-07-01

## Context

The final platform baseline requires a static React/Vite frontend, Firebase services, and GitHub Pages. The repository must remain maintainable as correctness-sensitive payroll features are added.

## Decision

- Use React 19, Vite 8, and strict TypeScript.
- Use pnpm workspaces for the frontend and Cloud Functions packages.
- Use React Router with hash routing for GitHub Pages compatibility.
- Keep Firebase configuration environment-driven, with stable project identifiers defaulted to `toyota-payroll`.
- Keep browser Firebase access behind a service boundary as modules are introduced.
- Reserve a TypeScript Cloud Functions package but export no functions in Step 1.
- Require format, lint, type, test, and build checks in CI.

## Consequences

GitHub Pages can host the application without rewrite support. TypeScript adds early safety for later calculation and data contracts. Firebase rules and functions remain deployable independently from the static site.
