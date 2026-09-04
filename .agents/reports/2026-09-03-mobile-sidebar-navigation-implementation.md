# Mobile sidebar navigation implementation

- Worktree/branch: local Phase 3 workspace (uncommitted user work preserved).
- Scope: `apps/mobile/src/ui/app-shell.tsx` only.
- Change: normalized Expo route-group paths before matching navigation items; active routes now match both the exact path and nested paths. Navigation links are explicit non-wrapping horizontal icon-and-label rows. The drawer now uses normal top flow so links start beneath the Faura-Farmer wordmark, while the profile area stays pinned to the bottom.
- Production: not touched.
- Limitations: no Android Debug Bridge executable was available on `PATH`, so emulator screenshot inspection remains a manual acceptance check.
