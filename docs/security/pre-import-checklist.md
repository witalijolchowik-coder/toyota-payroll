# Pre-import security checklist

Real employee data must not be imported until this checklist is complete.

## Firebase Authentication

- [ ] Email/Password provider is enabled in Firebase Authentication.
- [ ] First Firebase Auth user is created manually.
- [ ] The first user UID is copied from Firebase Console.

## App access allowlist

- [ ] Firestore document `appUsers/{uid}` exists for the first user.
- [ ] `active` is set to `true`.
- [ ] `role` is set to `admin` or `coordinator`.
- [ ] `email` and `display_name` are filled.
- [ ] Users who should not access the app have no active `appUsers` document.

## Rules and deployment

- [ ] Firestore rules are deployed.
- [ ] Storage rules are deployed.
- [ ] Unauthenticated users cannot read employee data.
- [ ] Authenticated users without an active `appUsers` document cannot read employee data.
- [ ] Inactive app users cannot read employee data.
- [ ] Approved active users can use the application according to current MVP rules.
- [ ] Users cannot create or update their own `appUsers` document.
- [ ] Settled month protections still work.
- [ ] Audit log remains append-only.

## GitHub Pages verification

- [ ] Opening the app while signed out shows the login page.
- [ ] Signing in with an unapproved Firebase user shows `Brak dostępu`.
- [ ] Signing in with the approved user shows the app shell.
- [ ] Sign-out returns the browser to an unauthenticated state.

Only after every item above is verified may the real employee import block begin.
