# Mobile offline reports replacement — implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** approved replacement of the mobile cash-flow report with offline-first account balance movement and category spending reports.
- **Changed areas:**
  - Added `apps/mobile/src/data/reports.ts`, a local ledger calculator for account balance timelines and root-category spending totals.
  - Rebuilt `apps/mobile/app/(tabs)/reports.tsx` around selected-account balance history for the past 7 days, 30 days, and 12 monthly points, expandable local transaction explanations, and a week/month category-spending bar chart.
  - Added last-successful-sync metadata to the local SQLite data layer.
  - Removed the mobile-only server report routes and shared server helper because reports are now derived entirely on-device.
- **Financial rules:** income and incoming transfers increase the selected account balance; expenses and outgoing transfers decrease it. The account starting balance is the ledger baseline.
- **Result:** complete locally. Reports remain available offline from the last synced account, category, and transaction records and refresh when the report screen regains focus or sync completes.
- **Known limitations:** a report cannot show changes made on another device until the next sync. Account creation timestamps are not stored in the existing mobile sync contract, so the starting balance is included as the pre-period baseline instead of a dated timeline event.
- **Production:** not touched. No migration, deployment, or environment change was made.
