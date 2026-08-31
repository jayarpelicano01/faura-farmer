# OAuth account-linking QA report

Date: 2026-08-31

## Passed checks

- `pnpm db:generate` passed.
- `pnpm --filter @faura-farmer/web test` passed: 6 files and 25 tests.
- `git diff --check` passed.
- `pnpm typecheck` passed before concurrently added Phase 2 regression tests entered the worktree.

The focused additions cover signed and expired link-intent cookies, unlink-last-login prevention, signed intent creation, and unlink session revocation.

## Blocked or failed checks

- A later `pnpm typecheck` failed because new unrelated root tests imported by `apps/web/src/lib/phase2-regression.test.ts` cannot resolve the `vitest` type from the web compiler. The OAuth source had no reported type error in that run.
- `pnpm build` first failed because another active Next build held `.next/trace` (`EPERM`). After the lock cleared, another optimized build exited unsuccessfully without a source diagnostic. No deployment was attempted.
- Browser OAuth verification was not run: provider apps/secrets are user-owned and the new migration remains unapplied. It still needs verification for new login, returning login, explicit link/unlink, collision, missing email, expired intent, replay, and provider failure.
