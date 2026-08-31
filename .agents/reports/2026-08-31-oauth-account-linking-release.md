# OAuth account-linking release report

Date: 2026-08-31

## Local delivery state

The OAuth identity and explicit linking implementation is present in the worktree. Prisma client generation and the web test suite passed. No database migration, provider-console change, Vercel environment change, deployment, or commit was performed.

## Required user-approved release steps

1. Back up production data and rehearse `20260831170000_oauth_identities_and_link_intents` on staging.
2. Apply the migration only after reviewing the rehearsal result.
3. Create the Google and Meta apps and register the localhost and production callback URLs documented in `README.md`.
4. Set `AUTH_SECRET`, provider IDs/secrets, `NEXT_PUBLIC_APP_URL`, and the public provider enable flags in the intended Vercel environments.
5. Resolve the current workspace build/typecheck blockers, then run browser acceptance checks before approving deployment.

Secrets are intentionally absent from source control and this report.
