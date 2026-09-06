# Mobile dashboard section links

- **Worktree / branch:** repository root / `main`
- **Scope:** Add direct navigation from Dashboard section headings only.
- **Changed areas:** `apps/mobile/app/(tabs)/dashboard.tsx`.
- **Result:** Recent transactions opens Transactions; Accounts opens Accounts. Both full section headers are accessible 44px link targets with pressed feedback. The account count remains visible.
- **Known limitations:** Metric cards remain informational because they have no separate destination screen.
- **Production touched:** No.
