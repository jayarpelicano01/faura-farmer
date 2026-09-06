# Account current-balance QA

- **Worktree / branch:** repository root / `main`
- **Scope:** Automated verification for current-balance presentation and adjustment behavior.
- **Checks run:** `pnpm --filter @faura-farmer/mobile typecheck`; `pnpm --filter @faura-farmer/web typecheck`; `pnpm --filter @faura-farmer/web test`; `git diff --check`.
- **Result:** Both type checks passed. Web Vitest passed all 10 files and 36 tests. Git whitespace checking passed with only existing line-ending conversion warnings.
- **Checks pending:** Android/iOS verification of positive and negative adjustment creation, a starting-balance-only edit, offline adjustment sync, and a web-to-mobile synchronized adjustment.
- **Production touched:** No.
