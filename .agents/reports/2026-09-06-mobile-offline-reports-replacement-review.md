# Mobile offline reports replacement — review

- **Worktree / branch:** repository root / `main`
- **Review focus:** local financial calculation consistency and offline behavior.
- **Findings:**
  - The selected account history includes transactions where it is the source or transfer destination, preventing destination-account transfers from being omitted.
  - The ledger direction matches the existing account balance query: income/incoming transfer add; expense/outgoing transfer subtract.
  - Category totals include only selected-account expense transactions and roll child categories into their root category, avoiding mixed-currency aggregation.
  - The Reports screen makes no network request. Sync is optional and updates local records through the established sync flow.
  - Old mobile report endpoints were removed; the desktop web reports feature remains unchanged.
- **Result:** no static-review issues found.
- **Production:** not touched.
