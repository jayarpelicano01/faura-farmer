# Shared display currency and all-account reports - implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Shared PHP/USD display preference, cached manual exchange-rate refresh, conversion-aware mobile values, and all-account mobile budget/comparison reports.
- **Changed areas:** User preference schema and committed migration; profile contracts and authenticated web/mobile endpoints; local mobile profile cache and currency context; mobile More settings, main money screens, and report calculations; web Profile currency controls.
- **Financial behavior:** Stored account, transaction, and budget amounts are retained. Conversion is applied for display and mobile amount input; budget storage remains PHP.
- **Report behavior:** Budget vs actual and Spending comparison aggregate every local expense across accounts, exclude transfers, and appear below the account-specific report cards behind an All accounts divider.
- **Production:** Not touched. The committed migration was not applied.