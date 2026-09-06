# Mobile Feature Parity Phase 3: Budgets QA

- **Worktree / branch:** repository root / `main`
- **Scope:** Static and automated validation for offline mobile budgets and their sync contract.
- **Checks run:** `pnpm --filter @faura-farmer/mobile typecheck`; `pnpm --filter @faura-farmer/web typecheck`; `pnpm --filter @faura-farmer/web test`; `git diff --check`.
- **Result:** Both TypeScript checks passed. The web Vitest suite passed all 10 files and 36 tests. Git whitespace checking passed; Git emitted existing line-ending conversion warnings only.
- **Coverage:** Shared contract validation includes budget and monthly-budget payloads; local records and outbox mutations accept both entities; server handlers enforce ownership, category type, hierarchy conflicts, single monthly budget, and tombstones; existing server budget records are added to the mobile change feed during pull.
- **Checks pending:** Physical Android validation for offline creation/edit/delete, reconnect synchronization, monthly target changes, bottom-safe FAB action, and dark/light rendering. Staging validation requires an enabled mobile API and an account with existing browser-created budgets.
- **Production touched:** No.
