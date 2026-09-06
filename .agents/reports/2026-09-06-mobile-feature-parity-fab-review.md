# Mobile FAB review

- **Worktree / branch:** repository root / `main`
- **Scope:** Source review of Mobile Feature Parity Specification, Phase 1.
- **Reviewed behavior:** The FAB is rendered as a sibling of app content, uses safe-area insets, has a 44px-or-larger interactive surface, hides on More, and auto-closes after pathname changes. Transaction and account query parameters are consumed after local records load and cleared to prevent repeat editor opens.
- **Result:** No type or source-level correctness issue found after the route-change close behavior was corrected during implementation.
- **Known limitations:** Native rendering and Expo bundling still need successful device or CI validation.
- **Production touched:** No.
