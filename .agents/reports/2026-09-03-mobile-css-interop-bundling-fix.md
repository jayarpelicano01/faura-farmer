# Mobile CSS interop bundling fix

- **Date:** 2026-09-03
- **Worktree / branch:** `faura-farmer-mobile-phase3` / `feature/mobile-phase3`
- **Scope:** Resolve Android Metro's missing `react-native-css-interop/jsx-runtime` module while retaining Expo SDK 55.

## Implementation

- Added `react-native-css-interop` version `0.2.6` as a direct dependency of `@faura-farmer/mobile`.
- Refreshed `pnpm-lock.yaml` with `pnpm install --offline`; no packages were downloaded and no SDK was upgraded.

## Verification

- Confirmed `require.resolve('react-native-css-interop/jsx-runtime')` succeeds from `apps/mobile`.
- Ran `pnpm --filter @faura-farmer/mobile typecheck` successfully.
- Ran `expo export --platform android` to a temporary directory successfully; the Android Hermes bundle was produced.

## Review and release boundary

- This change affects only local mobile dependency resolution.
- No database, Vercel configuration, preview deployment, production deployment, or production data was touched.
- Emulator/device acceptance remains required after restarting Expo with a cleared Metro cache.
