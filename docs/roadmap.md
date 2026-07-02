# Approved implementation roadmap

| Step | Scope                                                               | Status                      |
| ---- | ------------------------------------------------------------------- | --------------------------- |
| 1    | Project bootstrap, Firebase boundaries, GitHub Pages, documentation | Complete                    |
| 2    | Authentication                                                      | Awaiting bootstrap approval |
| 3    | Firestore foundation and final security-rule tests                  | Not started                 |
| 4    | Employees                                                           | Not started                 |
| 5    | Month initialization and settlement shell                           | Not started                 |
| 6    | Daily value entry                                                   | Not started                 |
| 7    | Absences                                                            | Not started                 |
| 8    | Recalculation function                                              | Not started                 |
| 9    | Adjustments                                                         | Not started                 |
| 10   | L4 and attendance import                                            | Not started                 |
| 11   | Reports                                                             | Not started                 |
| 12   | Month settlement and usability polish                               | Not started                 |

The repository must not proceed to Step 2 until the user approves the bootstrap.

## Step 1 acceptance criteria

- Local development server starts.
- Static production bundle builds.
- Firebase SDK initializes against the existing project when the API key is supplied.
- Firestore, Storage, Auth, Functions, and emulator boundaries are configured.
- Pushes to `main` can deploy to GitHub Pages.
- No business module or payroll logic exists.
