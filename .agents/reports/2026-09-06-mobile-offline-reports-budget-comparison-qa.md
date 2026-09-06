# Mobile offline budget and spending comparison reports — QA

- **Worktree / branch:** repository root / `main`
- **Checks run:**
  - `pnpm --filter @faura-farmer/mobile typecheck` — passed.
  - `pnpm --filter @faura-farmer/web typecheck` — passed.
  - `git diff --check` — passed; only existing line-ending conversion warnings were emitted.
  - Confirmed mobile source has no `/api/mobile/v1/reports` request or mobile report-auth helper reference.
- **External checks still required:** test a budgeted parent category with child-category expenses, unbudgeted and uncategorized expenses, an over-budget result, a historical month, and week/month comparison changes on the Redmi Note 14 4G.
- **Automated tests:** the local Vitest startup remains blocked by its Rolldown optional-binding issue; no test files ran.
- **Production:** not touched.
