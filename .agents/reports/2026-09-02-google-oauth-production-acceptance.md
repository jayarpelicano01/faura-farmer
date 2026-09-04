# Google OAuth production acceptance report

Date: 2026-09-02
Release decision: approved for Google launch

## Credential and deployment state

- The production owner confirmed that the exposed Upstash REST credential was rotated, the replacement REST URL and standard token were entered only in Vercel Production, and Production was redeployed.
- No credential material, account identifiers, personal email addresses, or provider identifiers were accessed or recorded.
- Facebook remains disabled. Its client credentials are absent from the Production variable listing.

## Automated production verification

Performed by the release agent on 2026-09-02 (Asia/Manila):

- `GET /api/auth/providers` returned HTTP 200 and listed `credentials` and `google`.
- A CSRF-protected Google sign-in initiation returned HTTP 302 to `accounts.google.com`.
- A dedicated non-personal password-registration test returned HTTP 201. The following credentials login returned HTTP 200 and produced an authenticated session.
- Vercel Production variable names required for Auth.js, database access, Upstash, Google, and the public app URL were listed. Values were not read.
- Vercel Production error logs for the final five-minute verification window contained zero entries and no rate-limit, Prisma, or OAuth-handler error signatures.
- `pnpm --filter @faura-farmer/web test` passed locally: 6 files and 24 tests.

## Manual browser acceptance

The production owner attested at 2026-09-02T23:53:36+08:00 that every scenario in `docs/auth-operations.md` passed using dedicated test accounts:

| Scenario | Result |
| --- | --- |
| New Google account creation and returning Google login | Passed |
| Existing password-email collision rejects without automatic linking | Passed |
| Explicit Profile connection followed by Google re-login | Passed |
| Disconnect ends sessions and protects the final sign-in method | Passed |
| Expired and replayed connection callbacks reject without identity mutation | Passed |
| Consent denial or provider failure shows a safe error without account mutation | Passed |

The owner also confirmed review of Vercel Function Logs, Upstash usage, and Supabase `security_events` for the release tests, with no unexpected Auth.js, Prisma, or rate-limit errors. Only outcomes and timestamps are retained here by design.

## Scope and rollback

- No application source, migration, dependency, Git history, or Facebook configuration changed during this release-closure work.
- If a post-release defect is found, roll back the Vercel deployment; do not roll back the additive Prisma migration automatically.
