# Mobile offline budget and spending comparison reports — implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** approved expansion of the offline Reports screen to restore Budget vs actual and Spending comparison.
- **Changed areas:**
  - Extended `apps/mobile/src/data/reports.ts` with local budget-variance and category-comparison calculators.
  - Restored both report cards in `apps/mobile/app/(tabs)/reports.tsx`.
  - Loaded locally synced budget records together with the selected account, categories, and transactions.
- **Calculation rules:**
  - Budget variance uses current category budget settings and selected-account expenses. A selected week compares spending from that month’s first day through the week ending; a selected month uses that full calendar month.
  - Spending comparison compares the selected account’s category expenses to the preceding seven days or previous calendar month.
  - Child-category expenses roll into their root category. Uncategorized and unbudgeted spending remain visible.
- **Result:** complete locally and offline-first. No network report endpoint is used.
- **Known limitation:** budgets are current settings, not historical snapshots, matching the prior report behavior.
- **Production:** not touched.
