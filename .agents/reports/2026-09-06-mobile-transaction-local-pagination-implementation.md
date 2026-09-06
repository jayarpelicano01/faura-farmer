# Mobile transaction local pagination

- **Worktree / branch:** repository root / `main`
- **Scope:** Paginate the mobile Transactions screen from the offline SQLite cache in batches of 20. No server transaction API or sync contract changed.
- **Changed areas:** `apps/mobile/src/data/db.ts` and `apps/mobile/app/(tabs)/transactions.tsx`.
- **Result:** The screen reads one 20-item page plus a one-row look-ahead probe, then uses `FlatList` to load the next cursor page as the user approaches the bottom. A matching SQLite index supports the active-record newest-first query. Creating, editing, or deleting a transaction reloads the first page and resets the cursor.
- **Known limitations:** First-time background synchronization still downloads the full change history. It is intentionally outside this offline-first screen-performance scope.
- **Production touched:** No.
