# Mobile button visual system QA

- Worktree/branch: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer` / `feature/mobile-phase3-delivery`
- Scope: local type, static, and Android-bundle validation for the shared mobile button change.

Checks run:

- `pnpm --filter @faura-farmer/mobile typecheck` — passed after restoring an account-list-only press style that the initial edit had removed.
- `pnpm --filter @faura-farmer/mobile exec expo export --platform android --output-dir C:\tmp\faura-farmer-android-export-20260903` — passed; a fresh Android Hermes bundle and asset set were exported.
- `git diff --check` — passed.
- Static checks confirmed `full`, `constrained`, and `compact` are defined in the primitive; the constrained size has `maxWidth: 200`; primary actions use `theme.buttonBackground`; destructive actions use the danger tone; and the obsolete Unlock, Log out, and header-action wrappers are absent.

External checks not run: visual light- and dark-mode acceptance, pressed-state inspection, and touch-target inspection on an Android emulator or device. This environment can export the Android bundle but has no attached/emulated Android runtime available for those checks.

Result: all locally runnable checks passed. Production was not touched.
