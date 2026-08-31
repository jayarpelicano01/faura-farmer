# Security hardening implementation report

Date: 2026-08-31

## Scope delivered

- JWT session-version revocation on password changes and password resets.
- OAuth provider-identity mapping with collision-safe account linking behavior.
- Managed Upstash REST rate limiting for authentication and mutations, with a production fail-closed configuration requirement.
- Password-reset tokens stored only as SHA-256 hashes and delivered through the Resend REST API.
- Request-origin checks, JSON body-size limits, and browser security response headers.
- PostgreSQL ownership constraints, transfer-integrity triggers, password-reset/audit tables, and an unapplied RLS migration.
- Bounded pagination for the primary transaction-list query and validation tests.

## Verification performed

- `pnpm db:generate` passed.
- `pnpm typecheck` passed.
- `pnpm --filter @faura-farmer/web test` passed: 2 files and 7 tests.
- `git diff --check` passed.
- The timing-equalization bcrypt hash was validated as a 60-character bcrypt cost-12 hash.

## Release gates and residual risk

- The migration at `packages/database/prisma/migrations/20260831143000_security_hardening/migration.sql` was not applied. Back up production data and rehearse it on staging first; it deliberately aborts if legacy ownership or transfer data is inconsistent.
- Do not enable PostgreSQL RLS for a production application role until that role is non-owner/non-`BYPASSRLS` and every tenant query is executed through the request-scoped `withTenant` transaction helper. The migration documents this prerequisite. Applying it before that application rollout can deny tenant queries; using a database owner would bypass RLS and provide no isolation.
- Production requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and a valid `NEXT_PUBLIC_APP_URL`. Missing or unavailable Upstash configuration fails protected mutations closed in production.
- The transaction-list endpoint now paginates its logical result set, but its account-filter path still first discovers incoming transfer-group IDs. If an account can have a very large number of transfer rows, replace that discovery query with a single indexed SQL/ORM relation query before claiming fully bounded work for that filter.
- `pnpm build` was attempted but did not finish because Next.js stalled while loading the configured external Google font; no deployment was performed.
