# Toyota Payroll

Foundation for the Toyota Payroll Engine MVP: a browser-based coordinator
workspace built with React, Vite, TypeScript, Material UI, and Firebase.

The repository currently includes the approved Step 5 month initialization and
settlement shell, Step 4 Employees module, and Step 3 Firestore foundation.
Authentication screens, daily editing, absences, adjustments, payroll
calculations, imports, and reports remain intentionally unimplemented.

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

`pnpm check` runs formatting, linting, TypeScript checks, unit tests, and
Firestore Security Rules tests against the emulator.

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

## Application shell

The responsive shell includes:

- top application bar and user placeholder;
- collapsible desktop navigation and mobile drawer;
- routes for every planned MVP module;
- global loading, notification, theme, authentication, and error providers;
- placeholder dashboard and module pages.

Firebase clients are initialized, and typed Firestore converters, domain
mappers, repository boundaries, and path helpers are available for future
modules.

## Employees

The Polish employee register reads and writes `/employees` through the typed
Firestore repository boundary. Coordinators can add, edit, search, filter, and
deactivate employees. TETA is normalized and checked for uniqueness among
active employees before writes; internal Firestore employee IDs are never
shown.

Firestore access still requires an existing Firebase Authentication session.
The module does not add anonymous sign-in or an authentication screen.

## Monthly settlement shell

The Polish monthly screen defaults to the previous payroll month and reads a
canonical `/months/{monthId}` document. A missing month is created only after
the coordinator chooses **Utwórz miesiąc**; selecting or viewing it is
side-effect free. The screen renders a horizontally scrollable, read-only
calendar grid. Employees are included through employment-date overlap,
regardless of their current `is_active` value.

Explicit daily values are displayed when present. Otherwise, eligible elapsed
working days show a virtual `8h`; this value is never written to Firestore.
Weekend, future-day, and public-holiday placeholder states are visually
separated. Settled months display a read-only banner.

## Firestore foundation

- Firestore documents use snake_case and `Timestamp`; domain models use
  camelCase and `Date`.
- Every operational employee reference contains `employee_id` and
  `teta_number`, never a copied employee name.
- Calculated settlements, reports, and pipeline fields have no client-write
  input types.
- Security Rules deny anonymous access, protect settled months, and keep
  `auditLog` append-only.
- `pnpm test:rules` validates the rules with synthetic emulator data.

## Documentation

- [Documentation index](docs/README.md)
- [Authoritative MVP architecture](docs/architecture/mvp-architecture.md)
- [Platform and deployment](docs/architecture/platform.md)
- [MVP data model](docs/architecture/data-model.md)
- [Implementation roadmap](docs/roadmap.md)
- [Bootstrap decisions](docs/decisions/0001-bootstrap-stack.md)
- [Employee identifier decision](docs/decisions/0002-employee-identifiers.md)
- [Firestore foundation decision](docs/decisions/0004-firestore-foundation.md)
- [Employees module decision](docs/decisions/0005-employees-module.md)
- [Payroll-period participation decision](docs/decisions/0006-payroll-period-participation.md)
- [Month settlement shell decision](docs/decisions/0007-month-settlement-shell.md)
