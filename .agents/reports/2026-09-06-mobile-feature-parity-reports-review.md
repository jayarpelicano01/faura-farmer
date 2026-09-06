# Mobile feature-parity reports — review

- **Worktree / branch:** repository root / `main`
- **Review focus:** authorization, calculation consistency, mobile navigation, and empty/error states.
- **Findings:**
  - Each mobile endpoint checks that the mobile API is enabled, validates the bearer token, and passes only the authenticated user ID to existing report queries.
  - Period calculation is shared with the web reports implementation, including the seven-day range and the six-month monthly cash-flow chart.
  - Currency values are constrained to ISO-style three-letter codes and are obtained from the user’s own accounts.
  - The screen refreshes a near-expiry access token before requests, handles connection failures, and distinguishes unavailable data from multi-currency budget limitations.
  - Reports is reachable from both the stack and drawer navigation.
- **Result:** no implementation issues identified during static review.
- **Known limitation:** the Vitest runtime failure described in the QA report prevents automated route-test execution in this local installation.
- **Production:** not touched.
