# Account current-balance review

- **Worktree / branch:** repository root / `main`
- **Scope:** Review of ledger consistency for editable current account balances.
- **Reviewed behavior:** Current balance remains derived from starting balance plus income, expenses, and transfers. Mobile computes an offline adjustment from its cached ledger. Web computes an adjustment from the transaction total inside the server transaction, then writes canonical account and transaction sync changes.
- **Result:** No blocking issue found in static review. The implementation avoids storing a second mutable balance field or changing the database schema.
- **Known limitations:** An offline device can target a balance without transactions that another device has not synchronized yet; the authoritative server ledger converges after synchronization, and the adjustment remains visible for review.
- **Production touched:** No.
