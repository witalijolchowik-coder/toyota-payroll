# ADR 0003: Application shell structure

- Status: Accepted
- Date: 2026-07-02

## Context

All future product modules need a consistent responsive layout, navigation,
feedback surfaces, routing, and integration boundaries before business
functionality is introduced.

## Decision

- Use Material UI as the shared component and theming system.
- Compose global concerns through dedicated providers for theme,
  authentication state, loading state, notifications, and error handling.
- Keep the default theme light while exposing a theme-mode context so a future
  dark-mode control does not require restructuring the application.
- Retain hash-based React Router navigation for GitHub Pages compatibility.
- Protect the application route tree with `ProtectedRoute`.
- Use a temporary authenticated shell identity until the approved
  authentication step connects Firebase Auth state.
- Keep page modules declarative and free of Firestore access.
- Isolate Firebase clients behind `src/services` before feature services are
  introduced.

## Consequences

Every planned module already has a stable route and placeholder workspace.
Future implementation replaces page content without changing global layout or
provider composition. The temporary authenticated state must not be mistaken
for production authentication or authorization.
