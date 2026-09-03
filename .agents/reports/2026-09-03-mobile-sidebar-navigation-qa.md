# Mobile sidebar navigation QA

- Worktree/branch: local Phase 3 workspace (uncommitted user work preserved).
- Check run: `pnpm --filter @faura-farmer/mobile typecheck`.
- Result: passed (`tsc --noEmit`).
- Static review: each menu item has `flexDirection: 'row'`, a fixed-width icon container, no wrapping, and a text label to its right. Route matching accepts a route group-free exact path or child path. Navigation is placed directly after the drawer header; the footer alone uses `marginTop: 'auto'`.
- External/manual checks pending: open the drawer on Android, confirm the current screen has the dark active background and white icon/label, then move through all four destinations.
- Production: not touched.
