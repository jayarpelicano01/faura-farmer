# Mobile Phase 3 staging checklist

The `feature/mobile-phase3` worktree intentionally has no production deployment,
environment change, database command, or Vercel `--prod` action.

Before Preview testing, an authorized operator must create a separate staging Postgres
database, apply `packages/database/prisma/migrations/20260903000000_mobile_phase3` to
that database only, and configure **Preview** variables only:

- `DATABASE_URL` and `DIRECT_URL` for the staging database;
- a distinct `MOBILE_AUTH_SECRET` (32+ characters);
- `MOBILE_API_ENABLED=true`;
- Preview's existing auth/rate-limit settings as appropriate.

Never set `MOBILE_API_ENABLED` on Vercel Production, change Production variables, or
use the production URL in Expo. Validate registration, login, lock, offline CRUD,
reconnect syncing, delete tombstones, token rotation/logout, and cross-user isolation
on both iOS and Android development builds before requesting a separate merge or
production approval.
