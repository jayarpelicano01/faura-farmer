# Mobile button visual system implementation

- Worktree/branch: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer` / `feature/mobile-phase3-delivery`
- Scope: native mobile button presentation and accessibility labels only; no authentication, transaction, sync, API, schema, dependency, environment, or production changes.
- Changed areas: `apps/mobile/src/ui/primitives.tsx`, lock screen, profile, Accounts, Transactions, Categories, and auth entry screens.

Implemented the shared native `Button` sizes: `full` (46px minimum target), `constrained` (46px minimum target, centered and capped at 200px), and `compact` (40px minimum target). The primitive now accepts an optional accessibility label, uses the theme `buttonBackground` surface for primary actions, keeps the `danger` fill for destructive actions, and applies the shared 14px rounded geometry, Albert Sans label, disabled opacity, and opacity/scale press feedback.

Removed the local Unlock and Log out wrappers, moved account/transaction/category header creation actions to the compact primitive, and made sign-in, registration, save/add, sync, and destructive actions explicit full-size consumers. Button handlers and all business behavior are unchanged.

Result: implementation complete. Production was not touched.

Known limitation: device/simulator visual acceptance is recorded separately as an external check because no Android runtime is available in this environment.
