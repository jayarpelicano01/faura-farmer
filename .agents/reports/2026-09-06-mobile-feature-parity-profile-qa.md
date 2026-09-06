# Mobile profile QA

- **Worktree / branch:** repository root / `main`
- **Scope:** Static and route-level validation for Mobile Feature Parity Specification, Phase 2.
- **Checks run:** Mobile and web TypeScript checks; focused mobile-profile route tests; complete web Vitest suite; Git whitespace check.
- **Coverage:** Anonymous profile requests are rejected; authenticated profile reads return `private, no-store`; username persistence normalizes case; wrong current passwords do not update the database; verified password changes increment `sessionVersion` and write a security event.
- **Checks pending:** A staging mobile API session and physical Android/iOS rendering test are required to validate bearer-token exchange, SQLite column upgrade, and password-change sign-out on device.
- **Production touched:** No.
