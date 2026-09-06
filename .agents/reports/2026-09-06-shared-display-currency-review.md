# Shared display currency and all-account reports - review

- **Worktree / branch:** repository root / `main`
- **Review:** The preference defaults to PHP and accepts only PHP or USD. Rate refresh is explicit, authenticated, rate-limited, and preserves the existing cached rate if the provider fails.
- **Review:** Conversion uses fixed-scale integer arithmetic before UI formatting; it does not mutate saved ledger values.
- **Review:** All-account budget and comparison calculations convert each expense from its source account currency before totaling, while account movement remains account-specific.
- **Known limitation:** The new web Profile setting persists the preference shared with mobile. Broader web report/dashboard conversion can be completed after a browser verification pass.
- **Production:** Not touched.