# Mobile auth entry and Metro watcher fix — evidence

- Worktree: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`
- Auth-routing issue: a signed-out session gate asynchronously navigated to `/login` while the root route synchronously redirected to `/dashboard`. The root redirect could win, placing a new user on Dashboard.
- Correction: the gate now renders a deterministic `/login` redirect for signed-out, non-auth routes. `/login` and `/register` remain renderable; an existing stored session still uses the intended device-lock flow. No session storage, API, server, or database behavior changed.
- Metro issue: the Expo monorepo watcher crawled Next's generated `apps/web/.next` directory while Next was writing/removing files, producing harmless `ENOENT` watcher warnings and expensive rebuilds.
- Correction: `apps/mobile/metro.config.js` now blocks only that generated web directory while retaining the workspace source watch scope and NativeWind configuration.
- Checks: `pnpm --filter @faura-farmer/mobile typecheck` passed. Expo successfully loaded the updated mobile configuration and Metro configuration when starting a clean Android export. The export was intentionally stopped after configuration/bundler startup verification to avoid leaving a nonessential high-CPU task running; an earlier clean Android export for the redesign completed successfully.
- Production, database, migrations, deployment, credentials, and environment files: untouched.
