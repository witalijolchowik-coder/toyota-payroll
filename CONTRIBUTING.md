# Contributing

## Development workflow

1. Create a focused branch from `main`.
2. Keep Firebase access behind `src/services` as features are introduced.
3. Keep business calculations out of React components.
4. Add or update tests for every behavior change.
5. Run `pnpm check && pnpm build && pnpm build:functions` before opening a pull request.

## Scope boundary

The current repository is Step 1 only. Consult [the roadmap](docs/roadmap.md) before starting a business module. Step 2 must not begin until the bootstrap is approved.

## Security

- Never commit `.env.local`, service-account credentials, or downloaded Firebase keys.
- Firebase web configuration identifies the project but does not replace Security Rules.
- Treat Firestore and Storage rules as production code and test changes with the Firebase emulators.
- Server-authoritative, multi-document, or long-running operations belong in Cloud Functions.
