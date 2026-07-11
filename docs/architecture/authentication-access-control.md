# Authentication and access control

Block 13 introduces real Firebase Authentication before any real employee import.

The public GitHub Pages deployment is acceptable only because application access is controlled by Firebase Auth and Firebase Security Rules. The Firebase web API key remains public by design; it is not a password and must not be used as the security boundary.

## Authentication model

- Sign-in uses Firebase Authentication email/password.
- There is no public registration screen.
- There is no Google login in this block.
- Firebase Auth persistence keeps the coordinator signed in between browser sessions.
- Unauthenticated users are redirected to the Polish login screen.
- Authenticated users without approved application access see `Brak dostępu` and may sign out.

## Application allowlist

Application access is controlled by Firestore documents:

```text
appUsers/{uid}
```

Recommended fields:

```text
email: string
role: "admin" | "coordinator" | "viewer"
active: boolean
display_name: string
created_at: timestamp
updated_at: timestamp
```

A user may access application data only when:

1. Firebase Auth has an authenticated user.
2. `appUsers/{uid}` exists.
3. `active` is `true`.

The first user is created manually in Firebase Console. Client code cannot create or update `appUsers` documents, so users cannot approve themselves.

## Firestore and Storage rules

Firestore business collections require an active `appUsers/{uid}` document. This applies to employees, months, daily values, absences, adjustments, settings, reports, exports and audit records.

The `appUsers` collection is protected:

- a signed-in user may read only their own access document;
- client create/update/delete is denied;
- manual administration is done through Firebase Console or future trusted admin tooling.

Storage read/create access for current import/report/export paths also requires an active app user. Writes that are not explicitly supported remain denied.

Existing protections remain in force:

- settled month child writes are denied;
- audit log is append-only and tied to the actor;
- calculated/pipeline fields are not client-writable;
- imported daily-value fields cannot be overwritten by client corrections.

## Manual Firebase Console bootstrap

Before importing real employee data:

1. In Firebase Console, open Authentication.
2. Enable the Email/Password provider.
3. Create the first user manually.
4. Copy the Firebase Auth UID.
5. Open Firestore Database.
6. Create document `appUsers/{uid}` using that UID.
7. Set:
   - `email` to the user email;
   - `role` to `admin` or `coordinator`;
   - `active` to `true`;
   - `display_name` to the coordinator/admin display name;
   - `created_at` and `updated_at` to server timestamps.
8. Deploy Firestore and Storage rules.
9. Open the GitHub Pages app and verify:
   - unauthenticated users see login;
   - a Firebase Auth user without `appUsers` sees `Brak dostępu`;
   - the approved user reaches the app shell.

## Current limitations

- Password reset is not implemented yet.
- User management UI is not implemented yet.
- Fine-grained feature permissions are intentionally deferred.
- Real employee import remains blocked until the security checklist passes.
