# Codebase runtime recovery - review

- **Worktree / branch:** repository root / `main`
- **Scope reviewed:** Generated Next output recovery and process cleanup.
- **Finding:** The missing `.next` manifests were generated-cache damage, not an application route defect. A complete production build restored them.
- **Finding:** The Vitest startup failure is caused by an unsupported local Node runtime (22.8.0) for the locked Rolldown 1.2.6 dependency, not a failing test assertion.
- **Risk:** No financial, authentication, database, dependency, or source behavior changed.
- **Production:** Not touched.