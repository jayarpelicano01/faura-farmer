# Codebase runtime recovery - QA

- **Worktree / branch:** repository root / `main`
- **Scope:** Verify repaired Next generated files and all workspace TypeScript projects.
- **Checks run:**
  - `pnpm --filter @faura-farmer/web build` compiled successfully and completed.
  - `pnpm typecheck` passed across config, database, types, mobile, and web workspaces.
  - Confirmed `apps/web/.next/routes-manifest.json` and `apps/web/.next/server/middleware-manifest.json` exist.
  - Confirmed no listener remains on ports 3000, 3100, or 8081.
- **Blocked check:** `pnpm --filter @faura-farmer/web test` cannot start because the installed Node 22.8.0 does not meet Rolldown 1.2.6's Node requirement, so pnpm did not install its Windows optional native binding.
- **External verification:** No browser, emulator, or staging verification was run.
- **Production:** Not touched.