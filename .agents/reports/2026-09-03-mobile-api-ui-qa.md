# Mobile API and web-aligned UI QA

- Worktree/branch: `main`, `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`.
- Production touched: no.

Passed checks:

- `pnpm install --offline --frozen-lockfile --force` linked the recovered Expo SDK 55 workspace; a later offline install linked the direct `expo-font` dependency and regenerated Prisma Client without a database operation.
- `pnpm --filter @faura-farmer/mobile typecheck` passed.
- `pnpm --filter @faura-farmer/mobile exec expo config --type public` passed and exposed the expected local public API URL, favicon icon, adaptive icon metadata, and SDK 55 configuration.
- `pnpm exec expo export --platform android --clear` completed a clean Android JavaScript export. The generated `dist` includes Metro output and bundled assets, validating the sibling favicon reference and local font assets.
- `pnpm --filter @faura-farmer/web typecheck` passed.
- `pnpm --filter @faura-farmer/web test` passed: 8 files and 28 tests.
- `pnpm --filter @faura-farmer/web build` compiled successfully and emitted the mobile login route. The build worker completed without an observed error after Next.js's full optimization phase.
- A local web server with the mobile gate enabled returned `400 {"error":"Required","code":"BAD_REQUEST"}` for an intentionally invalid mobile login payload. That validated route availability and input handling without creating an account or querying user data.

Not run:

- Real registration, logout, sign-in, and restart recovery against staging: requires a designated test account and would create or modify staging data.
- Emulator/device visual acceptance for camera cutouts and login/logout flow: no Android emulator or physical device was supplied.
