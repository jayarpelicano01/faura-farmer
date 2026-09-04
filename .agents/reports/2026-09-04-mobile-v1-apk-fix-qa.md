# Mobile v1 APK Fix QA

- **Date:** 2026-09-04
- **Branch:** `fix/mobile-v1-android-build`
- **Scope:** Android build fix validation
- **Production touched:** No

## Passed checks

- Generated icon dimensions: `1024x1024`.
- `pnpm --filter @faura-farmer/mobile typecheck` passed.
- `pnpm --filter @faura-farmer/web test` passed: 9 files, 31 tests.
- Expo resolves the square icon and Android v1 configuration.

## Remaining diagnostics

- Expo Doctor's remote app-config and React Native Directory checks timed out from
  this environment.
- The approved Metro override and React Native/SVG patch-version advisories remain.
  They were not the failed Gradle cause.
