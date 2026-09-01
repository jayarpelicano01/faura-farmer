# Credential forward-fix and OAuth operations report

Date: 2026-09-01

## Incident scope

A tracked configuration sample contained a populated Upstash Redis REST credential. It was treated as exposed. The user selected forward remediation after credential rotation rather than rewriting Git history.

## Repository remediation

- Replaced every sensitive configuration value in both `.env.example` files with an empty placeholder.
- Added the Upstash REST URL and token keys to the web deployment sample.
- Added `docs/auth-operations.md`, covering credential rotation, production configuration, Google acceptance scenarios, health checks, and incident triage.
- Linked the runbook from `README.md`.
- Audited the current tracked worktree without printing credentials: no sensitive sample variable has a non-empty value, and the previously committed Upstash URL and token are absent from current tracked files.

## Verification

- Sensitive-sample audit passed.
- `git diff --check` passed.
- `pnpm typecheck` passed.
- `pnpm --filter @faura-farmer/web test` passed: 6 files and 24 tests.
- `pnpm build` completed and produced the Next.js production build output.

## Required owner actions

1. Reset or revoke the exposed Upstash credential in the Upstash console.
2. Enter the replacement Upstash REST values in Vercel Production and redeploy.
3. Confirm login and registration no longer return rate-limit-service 503 responses.
4. Complete the Google browser acceptance checklist in `docs/auth-operations.md` using dedicated test accounts.

No credential values, user passwords, provider identifiers, or database connection strings are included in this report.
