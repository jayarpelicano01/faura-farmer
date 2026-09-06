# Mobile feature-parity reports — implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Phase 4 of `apps/mobile/MOBILE_FEATURE_PARITY_SPEC.md`.
- **Changed areas:**
  - Added the Reports mobile screen with rolling-week and monthly views, manual period selection, currency selection, cash-flow metrics and chart, budget variance, spending comparison, and spending by account.
  - Added authenticated, user-scoped mobile report endpoints for cash flow, budget variance, category comparison, and account spending.
  - Reused the established server report-query and period-range logic so web and mobile calculations stay aligned.
  - Added Reports to mobile stack navigation and drawer navigation.
  - Added `react-native-gifted-charts` and its required `react-native-linear-gradient` peer for the three-series cash-flow chart.
- **Result:** complete locally. Reports use bearer authentication, return `Cache-Control: private, no-store`, validate period and currency request parameters, and query only the authenticated user’s records.
- **Known limitations:** reports require an online signed-in session; no report cache is kept on-device. Budget variance is intentionally unavailable when an account set has more than one currency, matching the web application because budgets are not currency-specific.
- **Production:** not touched. No migration, deployment, or production configuration change was made.
