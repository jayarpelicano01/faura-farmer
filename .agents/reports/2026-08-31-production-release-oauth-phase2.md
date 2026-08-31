# Production release report: OAuth and Phase 2

Date: 2026-08-31

## Authorization and release artifact

- The user confirmed that the configured shared Supabase database had a completed backup and authorized application of every pending migration.
- Commit `7bbfb37` (`feat: add phase 2 finance workflows and OAuth account linking`) contains the selected 63-file OAuth and Phase 2 release.
- The commit was pushed to `origin/main`, which triggered the linked Vercel production deployment.

## Database release

Prisma `migrate deploy` applied, in order:

1. `20260831160000_recurring_transaction_type`
2. `20260831161000_transaction_attachments`
3. `20260831170000_oauth_identities_and_link_intents`

Post-deploy `prisma migrate status` reported that the database schema is up to date. The OAuth migration created the identity and link-intent storage and backfilled legacy Google/Facebook user mappings where present.

## Verification

- `git diff --check` passed before staging.
- `pnpm typecheck` passed for every workspace package.
- `pnpm --filter @faura-farmer/web test` passed: 6 files, 24 tests.
- A clean production build compiled successfully, completed type checking and page-data collection, and produced the Next.js build output. The local development server was stopped first because it shared the `.next` directory.
- Production `/api/auth/providers` lists both `credentials` and `google`.
- Production `/login` renders the **Continue with Google** control.
- The deployed registration endpoint accepts the configured production origin and returns validation errors normally for a deliberately malformed request.

## Limits and follow-up

- Google client credentials and the production enable flag were set by the user in Vercel; their values were not accessed or recorded.
- Facebook remains intentionally disabled.
- End-to-end OAuth consent, account linking, unlinking, and provider email-collision checks require a real user browser session and were not exercised by automation.
