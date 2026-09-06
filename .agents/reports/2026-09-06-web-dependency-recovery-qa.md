# Web dependency recovery — QA

- **Worktree / branch:** repository root / `main`
- **Incident:** Next could not load `@swc/helpers/cjs/_interop_require_default.cjs` because the installed package had an empty `cjs` directory.
- **Recovery:** stopped only the repository’s running web and Expo development processes, removed the generated root `node_modules` directory after confirming it was inside the workspace, and completed `pnpm install --frozen-lockfile` with a PTY so its linking and Prisma postinstall steps completed.
- **Checks:**
  - `pnpm --filter @faura-farmer/web typecheck` — passed.
  - `pnpm --filter @faura-farmer/web dev -- --hostname 127.0.0.1 --port 3100` — started successfully.
  - `GET http://127.0.0.1:3100` — HTTP 200.
  - `pnpm --filter @faura-farmer/web test` — still blocked by the unrelated optional Rolldown binding used by Vitest; no test files started.
- **Result:** Next runtime dependency resolution is restored. The development server is running at `http://127.0.0.1:3100`.
- **Production:** not touched.
