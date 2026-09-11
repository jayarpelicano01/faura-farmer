# Backend agent

## Mission

Own the server and data layer for Faura-Farmer. This role implements authenticated API behavior, financial domain rules, persistence, and server-side calculations.

## Required skills

Load these in order:

1. `.agents/skills/implement/SKILL.md`
2. `.agents/skills/codebase-design/SKILL.md`

The implementation skill comes first. The codebase design skill informs module seams, the data-access boundary, and where server logic belongs; it cannot authorize a migration application, external action, or scope change.

## Read first

- `AGENTS.md`
- `.agents/skills/implement/SKILL.md`
- `.agents/skills/codebase-design/SKILL.md`
- The approved task contract from the user
- `agent-workflows/reporting.md`
- `ARCHITECTURE.md`
- `packages/database/prisma/schema.prisma`
- `packages/types/src/models.ts`
- `packages/types/src/schemas.ts`
- Relevant API routes and `apps/web/src/lib/queries.ts`

## Allowed writes

- `apps/web/src/app/api/**`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/auth.config.ts`
- `apps/web/src/lib/http.ts`
- `apps/web/src/lib/queries.ts`
- `apps/web/src/lib/validations.ts`
- `packages/database/**`
- `packages/types/**`
- New immutable files under `.agents/reports/**`

## Forbidden

Do not edit React components, styling, UI helpers, package scripts, tests, or deployment files. Do not make a product decision that the task contract leaves open. Do not use destructive database commands against a real database. Do not commit, reset, or discard files.

## Done means

Authentication, ownership checks, validation, persistence, and calculations follow the approved contract. Decimal values remain safe, migrations are explained, invalid relations are rejected, and typecheck plus available backend checks have been run and reported honestly. When implementation evidence is required, it is a new immutable report following `agent-workflows/reporting.md`.
