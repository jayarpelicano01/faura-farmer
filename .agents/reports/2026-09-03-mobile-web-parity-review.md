# Mobile web-parity redesign — UI review evidence

- Worktree: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`
- Source of truth reviewed: web dark CSS variables, shared card/input/button components, dashboard widgets, auth card, and sidebar navigation.
- Typography: native Albert Sans body and Unbounded display hierarchy remains consistent with web weights and scale.
- Color/surfaces: native theme maps the web dark background, card, muted, border, primary-solid, accent, income, and expense tokens rather than using the former hard-coded light palette.
- Navigation: bottom tabs were replaced with an accessible drawer carrying the web's active/inactive navigation states, favicon wordmark, and profile footer; unavailable web-only pages are deliberately hidden.
- Screen review: auth, lock, Dashboard, accounts, transactions, categories, More, and editor sheets use a coherent web-derived card, list-row, field, and action hierarchy. Corrected visible punctuation in touched screen text.
- Accessibility review: `Pressable` controls retain roles, labels/hints were added to key drawer/list actions, active drawer state is announced, and primary targets remain at least 40–46px.
- Limitation: this static review and Android export do not replace a manual screenshot comparison on the user's emulator.
- Production, database, migrations, deployment, and credentials: untouched.
