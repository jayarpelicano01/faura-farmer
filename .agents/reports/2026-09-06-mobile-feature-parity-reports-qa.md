# Mobile feature-parity reports — QA

- **Worktree / branch:** repository root / `main`
- **Checks run:**
  - `pnpm --filter @faura-farmer/mobile typecheck` — passed.
  - `pnpm --filter @faura-farmer/web typecheck` — passed.
  - `git diff --check` — passed; Git emitted only existing line-ending conversion warnings.
  - `pnpm --filter @faura-farmer/web test` — blocked before test discovery. Vitest cannot load the local optional Rolldown native binding (`@rolldown/binding-wasm32-wasi`). A `pnpm install` completed but did not restore that binding.
- **External checks still required:** open Reports on a signed-in mobile build against a reachable API; verify period and currency changes, a multi-currency account set, empty report data, and the chart on the Redmi Note 14 4G.
- **APK-size check:** a fresh release APK has not been built or measured. The chart dependencies are now included and must be measured against the prior APK at release time.
- **Production:** not touched.
