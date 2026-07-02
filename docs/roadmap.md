# Approved implementation roadmap

| Step | Scope                                                               | Status      |
| ---- | ------------------------------------------------------------------- | ----------- |
| 1    | Project bootstrap, Firebase boundaries, GitHub Pages, documentation | Complete    |
| 2    | Responsive application shell and module placeholders                | Complete    |
| 3    | Firestore foundation and security-rule tests                        | Complete    |
| 4    | Authentication                                                      | Not started |
| 5    | Employees                                                           | Not started |
| 6    | Month initialization and settlement shell                           | Not started |
| 7    | Daily value entry                                                   | Not started |
| 8    | Absences                                                            | Not started |
| 9    | Recalculation function                                              | Not started |
| 10   | Adjustments                                                         | Not started |
| 11   | L4 and attendance import                                            | Not started |
| 12   | Reports                                                             | Not started |
| 13   | Month settlement and usability polish                               | Not started |

The Firestore-foundation sequencing amendment was approved on 2026-07-02. The
repository must not proceed to Step 4 without explicit approval.

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
