# Mobile profile implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Mobile Feature Parity Specification, Phase 2 only.
- **Changed areas:** Shared mobile profile type, local SQLite profile metadata upgrade, More screen, mobile profile and password API routes, and focused route tests.
- **Result:** Mobile users can read and edit name and username through bearer-token routes, cache read-only profile metadata locally, change a password, and are signed out immediately after a successful password change. The More screen also exposes theme control while retaining sync and logout controls.
- **Security behavior:** The routes require the existing mobile API flag and bearer-token authentication, apply request limits, return private no-store responses, validate with the existing schemas, and invalidate every mobile session through `sessionVersion` after a password change.
- **Known limitations:** OAuth connection management is intentionally deferred. Staging and physical-device API validation remain pending.
- **Production touched:** No.
