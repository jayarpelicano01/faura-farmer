# Mobile offline reports replacement — QA

- **Worktree / branch:** repository root / `main`
- **Checks run:**
  - `pnpm --filter @faura-farmer/mobile typecheck` — passed.
  - `pnpm --filter @faura-farmer/web typecheck` — passed after clearing stale generated route metadata.
  - `git diff --check` — passed; Git emitted only existing line-ending conversion warnings.
  - Verified no mobile source references remain to `/api/mobile/v1/reports`.
- **Automated tests:** the web Vitest runner remains blocked before test discovery by its local optional Rolldown binding; no web test files ran.
- **External checks still required:** test the account selector, all three timeline ranges, a source and destination transfer, account balance adjustment, offline mode, a successful resync, chart-point expansion, and week/month category ranges on the Redmi Note 14 4G.
- **Production:** not touched.
