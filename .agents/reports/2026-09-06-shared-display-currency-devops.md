# Shared display currency and all-account reports - DevOps

- **Worktree / branch:** repository root / `main`
- **Database:** Added a committed Prisma migration only. It has not been run against local staging or production.
- **External service:** Manual rate refresh uses the no-key Frankfurter PHP/USD endpoint through server Route Handlers; clients do not contact the provider directly.
- **Runtime:** Stopped the stalled Next build verification process. No Expo, Next development server, or build process remains running.
- **Production:** Not touched.