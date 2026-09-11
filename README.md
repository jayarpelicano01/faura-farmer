<div align="center">

# Faura-Farmer

> A personal finance tracker: a monorepo with a typed Next.js app, Prisma data layer, and OAuth auth.

[![Live Demo](https://img.shields.io/badge/live-faura--farmer.vercel.app-FFD700)](https://faura-farmer.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)](https://www.prisma.io)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

## What it is

**Faura-Farmer** is a personal finance tracker built as a pnpm monorepo. It lets a user sign in, record transactions, and see where their money goes through charts and summaries. The codebase is fully typed end-to-end, from the database schema to the form inputs.

## Features

- **Account auth** via NextAuth v5 with email/password plus Google and Facebook OAuth
- **Transaction tracking** with typed forms (React Hook Form + Zod validation)
- **Spending insights** rendered as interactive charts (Recharts)
- **Typed data layer** with Prisma 6 (schema → client, no loose SQL strings)
- **Shared design system**: Radix UI primitives + shadcn-style utilities (CVA, `tailwind-merge`, `clsx`)
- **Monorepo structure**: `apps/web` for the app, `packages/*` for config, database, and shared types

## Screenshot

![Faura-Farmer app](apps/web/public/faura-farm.png)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v3 · Radix UI |
| Auth | NextAuth v5 (Auth.js) with Google / Facebook OAuth |
| Database | Prisma 6 (PostgreSQL) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Package mgr | pnpm workspaces (monorepo) |

## Project Structure

```
apps/
└── web/                  # Next.js app (UI + API routes)
packages/
├── config/              # Shared config: tailwind, design tokens
├── database/            # Prisma schema + client
└── types/               # Shared TypeScript types (date-fns, zod)
```

## Getting Started

Requires **Node.js 18+** and **pnpm**.

```bash
# install dependencies
pnpm install

# set up environment (see .env.example)
cp .env.example .env.local

# push the database schema
pnpm db:push

# run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Live at [faura-farmer.vercel.app](https://faura-farmer.vercel.app) (Vercel). To redeploy: push to GitHub and import the repo in [Vercel](https://vercel.com), then set the environment variables from `.env.example`.

## Commands

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start the web app in dev |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm db:push` | Push Prisma schema to the database |
| `pnpm db:studio` | Open Prisma Studio |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Var | Description |
|-----|-------------|
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL connection strings |
| `AUTH_SECRET` | Auth.js session secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Facebook OAuth credentials |
| `NEXT_PUBLIC_APP_URL` | Public app URL |
| `NEXT_PUBLIC_GOOGLE_ENABLED` / `NEXT_PUBLIC_FACEBOOK_ENABLED` | Toggle OAuth buttons |

## OAuth setup

OAuth accounts are never linked merely because their email address matches an existing
Faura-Farmer account. A user who already has an account must sign in with an existing
method and connect Google or Facebook from **Profile → Sign-in methods**. An account
cannot remove its last remaining sign-in method.

Create the Google Cloud OAuth client and Meta Facebook Login app yourself, then set the
credentials in local and Vercel environment settings. Do not commit provider secrets.
Set each public enable flag to `true` only after its corresponding client ID and secret are
configured; otherwise the provider button stays hidden.

Register these exact redirect URIs with both providers:

- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/facebook`
- `https://faura-farmer.vercel.app/api/auth/callback/google`
- `https://faura-farmer.vercel.app/api/auth/callback/facebook`

Google requests `openid email profile`; Facebook requests `email public_profile`. Provider
responses without an email are rejected. Before deploying this feature, back up production
data and rehearse the OAuth identity migration on staging; migration application and Vercel
environment changes remain separate user-approved release steps.

See [authentication operations](docs/auth-operations.md) for credential rotation,
production configuration, OAuth acceptance checks, and incident triage.

## Author

**Agustin Ronato Pelicano Jr. (Jay Ar)**, Junior & Full-Stack Software Developer

- 💻 GitHub: [@jayarpelicano01](https://github.com/jayarpelicano01)
- 💼 LinkedIn: [agustin-pelicano-jr-77062a3a6](https://www.linkedin.com/in/agustin-pelicano-jr-77062a3a6/)
- ✉️ Email: [jayarpelicano01@gmail.com](mailto:jayarpelicano01@gmail.com)

## License

Released under the [MIT License](LICENSE). See [LICENSE](LICENSE) for details.
