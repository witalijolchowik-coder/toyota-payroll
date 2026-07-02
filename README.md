# Toyota Payroll

Bootstrap for the Toyota Payroll Engine MVP: a browser-based coordinator workspace built with React, Vite, TypeScript, and Firebase.

This repository currently contains only the Step 1 foundation. Authentication screens, employees, monthly settlement, absences, adjustments, payroll calculations, imports, and reports are intentionally not implemented.

## Prerequisites

- Node.js 22
- pnpm 11
- Access to the existing Firebase project `toyota-payroll`

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Replace `VITE_FIREBASE_API_KEY` with the Firebase web API key.
3. Install and run:

   ```shell
   pnpm install
   pnpm dev
   ```

The other Firebase identifiers already point to the existing project.

## Quality checks

```shell
pnpm check
pnpm build
pnpm build:functions
```

`pnpm check` runs formatting, linting, TypeScript checks, and unit tests.

## Firebase

The repository is linked to `toyota-payroll` through `.firebaserc`.

```shell
pnpm firebase:emulators
pnpm firebase:deploy:rules
```

The initial Firestore and Storage rules deny anonymous access. Cloud Functions have an empty TypeScript entry point reserved for later server-authoritative operations.

## GitHub Pages

Pushes to `main` run the quality checks, build the static application, and deploy `dist/` to GitHub Pages. Before the first deployment:

1. Set the repository Actions variable `VITE_FIREBASE_API_KEY`.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Add the deployed Pages origin to Firebase Authentication's authorized domains before Step 2.

The app uses hash-based routing to avoid project-page refresh failures.

## Documentation

- [Documentation index](docs/README.md)
- [Authoritative MVP architecture](docs/architecture/mvp-architecture.md)
- [Platform and deployment](docs/architecture/platform.md)
- [MVP data model](docs/architecture/data-model.md)
- [Implementation roadmap](docs/roadmap.md)
- [Bootstrap decisions](docs/decisions/0001-bootstrap-stack.md)
- [Employee identifier decision](docs/decisions/0002-employee-identifiers.md)
