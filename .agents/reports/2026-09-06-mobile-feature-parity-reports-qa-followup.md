# Mobile feature-parity reports — QA follow-up

- **Worktree / branch:** repository root / `main`
- **Follow-up action:** ran `pnpm install --force` to repair the Vitest optional native binding, then reran checks.
- **Results:**
  - `pnpm --filter @faura-farmer/mobile typecheck` — passed.
  - `pnpm --filter @faura-farmer/web typecheck` — passed.
  - `git diff --check` — passed, with existing line-ending conversion warnings only.
  - `pnpm --filter @faura-farmer/web test` — still blocked during Vitest startup by the missing local Rolldown binding. No test files ran.
- **Conclusion:** the report implementation is type-safe; the web test suite remains unavailable because of the local test-runner installation, despite a forced workspace reinstall.
- **Production:** not touched.
