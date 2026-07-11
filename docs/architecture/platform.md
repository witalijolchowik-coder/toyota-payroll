# Platform and deployment

## Locked platform

| Concern               | Decision                  |
| --------------------- | ------------------------- |
| Frontend              | React + Vite static SPA   |
| Language              | TypeScript                |
| Hosting               | GitHub Pages              |
| Authentication        | Firebase Authentication   |
| Database              | Cloud Firestore           |
| Files                 | Firebase Storage          |
| Backend execution     | Firebase Cloud Functions  |
| Source control and CI | GitHub and GitHub Actions |

The primary context is a desktop coordinator workspace. Responsive behavior remains required for mobile access. Offline support is not an MVP requirement.

## Repository boundaries

- `src/pages` contains route-level composition.
- `src/features` is reserved for independently maintained business modules.
- `src/services` isolates Firebase SDK calls from React components.
- `src/config` contains runtime integration configuration, never business calculations.
- `functions/src` contains server-authoritative operations. Its runtime SDK
  dependencies are added with the first approved function, so the Step 1
  package stays empty and deploys nothing.
- `docs` holds the extracted implementation authority.

Feature folders are created when their approved implementation step begins; empty business-module scaffolding is intentionally avoided.

## Routing

The SPA uses hash routing. GitHub project pages do not rewrite arbitrary paths to `index.html`, so hash routing prevents refresh and deep-link failures without a custom 404 redirect.

Vite uses `/toyota-payroll/` as its production asset base in GitHub Actions and `/` during local development.

## Firebase environments

The default Firebase CLI project is `toyota-payroll`. The browser app includes
the public Firebase web configuration for this project, including the web API
key. These values are not private credentials; security is enforced by Firebase
Authentication plus Firestore and Storage rules. `VITE_FIREBASE_*` environment
variables may still override the defaults for local testing or a future
environment split.

Setting `VITE_USE_FIREBASE_EMULATORS=true` in local development connects Auth, Firestore, and Storage to the configured local emulators.

## Deployment

The Pages workflow:

1. installs the locked pnpm dependency graph;
2. runs formatting, lint, type, and unit checks;
3. builds the Vite application;
4. publishes `dist/` with the official Pages actions.

Firebase rules are deployed separately because GitHub Pages deployment must not mutate the Firebase backend.
