# Mobile FAB implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Mobile Feature Parity Specification, Phase 1 only.
- **Changed areas:** Shared app shell, new floating-actions UI component, Transactions route handling, and Accounts route handling.
- **Result:** Added a safe-area-aware 56px floating action button with animated quick actions for income, expense, transfer, account, and category creation. It is hidden on More, dismisses through its backdrop, explicit close, or navigation, and sends one-time Expo Router parameters to the appropriate editor.
- **Known limitations:** Physical-device visual validation remains pending. No Budgets, Reports, Profile, backend, schema, dependency, or deployment work was included.
- **Production touched:** No.
