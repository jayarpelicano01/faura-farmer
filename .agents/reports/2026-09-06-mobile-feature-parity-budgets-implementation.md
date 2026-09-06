# Mobile Feature Parity Phase 3: Budgets implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Add the approved offline-first mobile Budgets feature: category budgets, monthly budget target, 50/30/20 guide, local persistence, and bidirectional sync.
- **Changed areas:** Mobile budget screen and navigation/FAB; shared mobile sync contracts; local SQLite entity tables; server mobile sync handlers, baseline backfill, and browser budget/category change-feed bridges.
- **Result:** Users can create, edit, and delete expense-category budgets offline and set a monthly budget target. The screen calculates current-month category and bucket spending from the local cache, queues local changes, and preserves existing server budgets through a change-feed backfill on the next pull.
- **Financial safeguards:** Positive decimal validation, expense-category-only budgets, one budget per related category hierarchy, one monthly budget per user, ownership checks, tombstone checks, and category-deletion budget tombstones are enforced.
- **Known limitations:** The screen has not been exercised on an Android device or against a staging mobile API session. Values from accounts with different currencies are displayed using the first cached account currency, matching the existing local mobile data model's lack of currency conversion.
- **Production touched:** No.
