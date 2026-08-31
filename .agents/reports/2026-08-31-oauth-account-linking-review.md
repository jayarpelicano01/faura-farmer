# OAuth account-linking review report

Date: 2026-08-31

## Recommendation

The OAuth implementation is acceptable for staging rehearsal after the current unrelated workspace checks are repaired. It is not ready for production deployment yet.

## Reviewed controls

- Provider identity ownership is globally unique by `(provider, providerAccountId)` and cannot be transferred through a link attempt.
- Linking requires the provider-specific intent, a signed HttpOnly cookie, Auth.js state validation, and the still-active initiating session.
- Link intent consumption is conditional on `used_at IS NULL` and expiry, preventing replay.
- Existing email matches are rejected during direct OAuth login; no email-based auto-link path remains.
- Unlinking preserves at least one sign-in method and revokes all sessions after an identity is removed.
- Profile exposes only provider state and `hasPassword`, never a password hash or OAuth account identifier.
- The migration is additive and backfills the legacy provider mapping without relying on a PostgreSQL UUID extension.

## Release blockers

1. Rehearse and explicitly approve migration application after a staging backup.
2. Fix the unrelated Vitest type-resolution failure so the standard workspace typecheck passes again.
3. Resolve the optimized-build failure and complete browser OAuth verification with real provider test apps.
4. Explicitly approve Vercel environment configuration and deployment.
