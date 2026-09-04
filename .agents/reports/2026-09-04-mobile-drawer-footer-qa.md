# Mobile Drawer Footer QA

- **Date:** 2026-09-04
- **Branch:** `feature/mobile-phase3-delivery`
- **Scope:** `apps/mobile/src/ui/app-shell.tsx` drawer footer
- **Production touched:** No

## Checks run

| Check | Result |
| --- | --- |
| `pnpm --filter @faura-farmer/mobile typecheck` | Passed |
| `git diff --check -- apps/mobile/src/ui/app-shell.tsx` | Pending final focused check |

## Device checks still required

- In Expo Go, confirm the profile action opens `/more`.
- Confirm the sun/moon control toggles the active theme.
- Confirm pressed accent feedback, name/email truncation, and contrast in light and dark modes.
