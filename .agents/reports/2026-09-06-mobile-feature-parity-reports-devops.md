# Mobile feature-parity reports — DevOps / release

- **Worktree / branch:** repository root / `main`
- **Release activity:** none.
- **Environment changes:** package manifest and pnpm lockfile updated locally for the chart implementation. No environment variable, native build profile, deployment, or database migration was changed.
- **Required release follow-up:** create a new Android release build and measure its installed APK size before distribution. Confirm it remains within the previously agreed chart-dependency budget.
- **Production:** not touched.
