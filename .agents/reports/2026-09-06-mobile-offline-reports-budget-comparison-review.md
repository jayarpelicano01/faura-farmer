# Mobile offline budget and spending comparison reports — review

- **Worktree / branch:** repository root / `main`
- **Review focus:** selected-account scope, category hierarchy, range boundaries, and money direction.
- **Findings:**
  - Both cards filter to the selected account, so separate account currencies are never aggregated together.
  - Budget spending includes all descendants of the budget category and excludes any category already covered by a budget from the unbudgeted total.
  - Week comparison uses the immediately prior seven-day window; monthly comparison uses the previous calendar month.
  - Only expense transactions participate in budget and category spending calculations; income and transfers do not affect these reports.
- **Result:** no static-review issue identified.
- **Production:** not touched.
