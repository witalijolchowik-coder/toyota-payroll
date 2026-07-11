# ADR 0019: Firebase Auth with appUsers allowlist

## Status

Accepted.

## Context

The application is deployed publicly on GitHub Pages and the next implementation block will import real HR/payroll data. Public hosting is fine for a single-page application only if all data access is protected by Firebase Authentication and Firebase Security Rules.

Email/password login is sufficient for the MVP. Public sign-up is not acceptable because any authenticated Firebase user must not automatically receive access to employee data.

## Decision

Use Firebase Authentication email/password for login and a Firestore allowlist collection:

```text
appUsers/{uid}
```

The app considers a user approved only when the matching `appUsers/{uid}` document exists and has `active: true`.

Client-side application routes are protected:

- unauthenticated users see the login page;
- authenticated but unapproved users see a no-access screen;
- approved active users see the app shell.

Firestore rules enforce the same boundary. Business collections are readable/writable only by approved active app users according to the existing collection-specific validations. `appUsers` documents can be read by their owner but cannot be created, updated or deleted from client code.

Storage rules use the same approved-active-user boundary for currently defined import/report/export paths.

## Consequences

- The first app user must be bootstrapped manually in Firebase Console.
- Regular users cannot grant themselves access.
- The public Firebase config remains safe to commit because the security boundary is Auth + rules.
- Future admin UI can be added later without changing the core data-access model.
- Real employee import remains blocked until the pre-import security checklist passes.
