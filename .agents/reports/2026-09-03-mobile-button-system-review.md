# Mobile button visual system review

- Worktree/branch: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer` / `feature/mobile-phase3-delivery`
- Scope reviewed: shared mobile button API, its primary/destructive variants, and migrated screen call sites.

Review findings:

- The default full button retains a 46px minimum target and stretches in form and card layouts; `constrained` owns the lock-screen width cap without a screen-local visual wrapper; compact creation actions retain a 40px minimum target.
- Primary labels use the white theme foreground with the Albert Sans body family at 14px; the dark primary surface comes from `buttonBackground`. Danger actions preserve the existing danger token while inheriting the same geometry and press feedback.
- Pressed feedback changes only opacity and scale. Disabled buttons remain disabled, retain the same target geometry, and expose disabled accessibility state.
- Accounts, Transactions, and Categories pass descriptive accessibility labels for their icon-free compact creation actions. Existing handlers, navigation, validation, sync calls, and delete confirmations were not changed.
- Plain, outline, chip, and navigation controls remain secondary treatments and were not folded into the primary surface.

Result: no blocking code-review defects found. Production was not touched.

Known limitation: visual rendering was not inspected on a running Android device or emulator.
