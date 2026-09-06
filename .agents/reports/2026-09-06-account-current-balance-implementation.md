# Account current-balance implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Show derived current balances in mobile accounts and allow current-balance adjustments on mobile and web while preserving the transaction ledger.
- **Changed areas:** Mobile Accounts screen; web account editor and account update route; shared account update validation.
- **Result:** Mobile now displays current balance as the primary amount and starting balance beneath it. Editing a current balance creates a dated income or expense transaction named `Balance adjustment`; starting balance remains directly editable. The web editor uses the server's authoritative account total to create the same adjustment and publishes it to mobile sync.
- **Financial safeguards:** Current-balance input is bounded and validated; the server calculates the adjustment inside the account update transaction; zero-difference saves create no transaction; account and adjustment change-feed updates are published together after commit.
- **Known limitations:** Balance adjustments are ordinary uncategorized income or expense records, so they are visible in history and affect aggregate reporting by design.
- **Production touched:** No.
