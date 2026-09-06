# Shared display currency and all-account reports - QA

- **Worktree / branch:** repository root / `main`
- **Checks passed:** `pnpm --filter @faura-farmer/mobile typecheck` and `pnpm --filter @faura-farmer/web typecheck`.
- **Static checks:** `git diff --check` found no whitespace errors.
- **Build check:** The finite `pnpm --filter @faura-farmer/web build` compiled its initial Next phase but stalled during final processing. It was stopped; no server process remains. The earlier concurrent typecheck failure was generated `.next` cache contention while Next rebuilt files, and sequential typechecks passed afterwards.
- **Not run:** Vitest remains blocked by the unsupported local Node 22.8.0/Rolldown binding combination; device and browser verification require an emulator or physical device.
- **Production:** Not touched.