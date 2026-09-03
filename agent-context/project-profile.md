# Project profile

Faura-Farmer is a pnpm TypeScript monorepo. `apps/web` is a Next.js 15 App Router
application using Auth.js, Prisma 6, Zod, Tailwind, and Vitest. Shared packages are
`@faura-farmer/types` (models and validation) and `@faura-farmer/config` (design
tokens); `@faura-farmer/database` owns the Prisma PostgreSQL schema and client.

Web server components read through `apps/web/src/lib/queries.ts`. Client mutations
use Route Handlers, which authenticate first, validate with Zod, scope every query by
the authenticated user, and return helpers from `apps/web/src/lib/http.ts`.
Amounts are serialized as decimal strings at client boundaries. Transfers are stored
as paired rows identified by `transferGroupId`, with `outgoing` and `incoming` roles.

The standard commands are `pnpm build`, `pnpm lint`, `pnpm typecheck`,
`pnpm --filter @faura-farmer/web test`, and the database package's Prisma generation
and migration commands. Vercel hosts the web app and Supabase Postgres is the
production database. Browser auth is Auth.js JWT/cookie based.

User-facing work includes web routes and Route Handlers, plus the Phase 3 Expo app's
screens, offline state, sync traffic, and unlock states. Server-facing work includes
bearer-token auth, validations, mutation services, Prisma persistence, and sync
responses. Production deployment, production variables, and migration application
remain user-controlled external actions.
