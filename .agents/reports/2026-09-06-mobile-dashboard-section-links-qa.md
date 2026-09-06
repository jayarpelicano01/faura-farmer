# Mobile dashboard section links QA

- **Worktree / branch:** repository root / `main`
- **Scope:** Static validation for Dashboard section navigation.
- **Checks run:** `pnpm --filter @faura-farmer/mobile typecheck` passed; `git diff --check` passed with only existing line-ending warnings.
- **Known limitations:** Physical-device tap validation is pending.
- **Production touched:** No.
