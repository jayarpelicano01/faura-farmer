<div align="center">

<img src="apps/web/public/faura-farm.png" alt="Faura Farmer logo" width="160" />

# Faura Farmer

> A typed, cross-platform personal finance workspace for understanding where your money goes.

[![Live Demo](https://img.shields.io/badge/live-faura--farmer.vercel.app-FFD700)](https://faura-farmer.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Expo](https://img.shields.io/badge/Expo-55-000020)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)](https://www.prisma.io)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

Faura Farmer is a personal finance tracker built as a pnpm TypeScript monorepo. It
combines a Next.js web application and an Expo mobile application with a shared API,
PostgreSQL database, validation layer, and design tokens.

Both clients are included in the repository. The web app is deployed at the live demo
above, while the mobile client is available for local and preview development with
offline-first storage and synchronization.

## Download the Android app

| App | Download | Choose this when |
| --- | --- | --- |
| Faura Farmer 1.0.0 | [Download the production ARM64 APK](https://github.com/jayarpelicano01/faura-farmer/releases/download/v1.0.0/faura-farmer-v1.0.0-arm64.apk) | You want the online app with sign-in and sync. |
| Faura 1.0.0 Offline Friends | [Download the local-only ARM64 APK](https://github.com/jayarpelicano01/faura-farmer/releases/download/v1.0.0-offline-friends/faura-v1.0.0-offline-friends-arm64.apk) | You want a private local-only app with no online workspace or sync. |

Both APKs require a modern 64-bit Android phone. The offline app has its own package
identity and can be installed alongside the production app without sharing data.

## Highlights

- **See the full picture:** dashboard totals, account balances, spending reports, and
  balance timelines.
- **Record real-world finances:** customizable accounts, categories, income, expenses,
  transfers, recurring rules, budgets, and debt ledgers.
- **Move data safely:** CSV transaction import and export plus portable financial backup
  and restore flows.
- **Use it across devices:** the Expo client stores workspace data in local SQLite and
  synchronizes changes through a typed mobile API when connectivity returns.
- **Keep data separated:** authenticated requests are validated with Zod and scoped to
  the signed-in user before database access.
- **Build consistently:** shared TypeScript models, validation contracts, Tailwind
  design tokens, and Prisma database types are used across the workspace.

## Product surfaces

| Surface | What it provides |
| --- | --- |
| Web app | Dashboard, accounts, transactions, budgets, recurring rules, reports, debts, categories, profile, and backup tools |
| Mobile app | Expo Router client with local SQLite storage, offline CRUD, sync queues, reports, budgets, recurring rules, debts, app locking, and portable backup flows |

## Architecture

```text
  Next.js web app                 Expo mobile app
          \                              /
           \                            /
            v                          v
             Next.js API route handlers
                         |
                         v
                 Prisma + PostgreSQL

  Shared packages: types, validation, database client, and design configuration
```

The web app reads through a typed query layer. Client mutations use authenticated Route
Handlers, validate input at the boundary, scope queries by user, and return serialized
responses. The mobile app writes locally first, stores pending mutations in an outbox,
then pushes and pulls canonical changes through the mobile API during synchronization.

## Tech stack

| Area | Technology |
| --- | --- |
| Web | Next.js 15 App Router, React 19, Tailwind CSS, Radix UI, Recharts |
| Mobile | Expo 55, React Native 0.83, Expo Router, NativeWind, SQLite |
| Language | TypeScript |
| Authentication | Auth.js v5 with email/password, Google, and Facebook OAuth |
| Validation | Zod and React Hook Form |
| Data | Prisma 6 with PostgreSQL, hosted on Supabase in production |
| Hosting | Vercel for the web application and API |
| Testing | Vitest for web and Jest with Expo for mobile |
| Workspace | pnpm workspaces |

## Repository structure

```text
apps/
├── web/                  # Next.js UI and API routes
└── mobile/               # Expo Router mobile client
packages/
├── config/               # Shared design tokens and Tailwind configuration
├── database/             # Prisma schema and database client
└── types/                # Shared models, validation, and mobile contracts
docs/                     # Authentication and mobile staging runbooks
```

## Getting started

Requires Node.js 18+ and pnpm 9.12.0.

```bash
# Install dependencies
pnpm install

# Create local configuration
cp .env.example .env.local

# Generate the Prisma client
pnpm db:generate

# Apply the schema to a local development database
pnpm db:push

# Start the web application
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) after the development server starts.

To start the mobile client:

```bash
pnpm --filter @faura-farmer/mobile start
```

Set `EXPO_PUBLIC_API_URL` to a local server or an approved Vercel Preview URL before
using the mobile client. The mobile development boundary and staging requirements are
documented in [`apps/mobile/README.md`](apps/mobile/README.md) and
[`docs/mobile-staging.md`](docs/mobile-staging.md).

## Environment configuration

Copy [`.env.example`](.env.example) to `.env.local` and configure the values needed for
your environment. The main groups are:

- PostgreSQL connection strings: `DATABASE_URL` and `DIRECT_URL`
- Auth.js and password reset settings: `AUTH_SECRET`, Resend, and rate-limit variables
- OAuth credentials and public provider flags for Google and Facebook
- Public application URL: `NEXT_PUBLIC_APP_URL`
- Mobile Preview settings: `MOBILE_API_ENABLED` and a separate `MOBILE_AUTH_SECRET`

Never commit secrets, production environment files, or provider credentials. For OAuth
callback URLs, credential rotation, and production checks, see
[`docs/auth-operations.md`](docs/auth-operations.md).

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the web app in development |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Run workspace lint scripts |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm --filter @faura-farmer/web test` | Run web tests with Vitest |
| `pnpm --filter @faura-farmer/mobile test` | Run mobile tests with Jest |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:push` | Push the schema to a local development database |
| `pnpm db:studio` | Open Prisma Studio |

## Deployment

The web application is deployed on [Vercel](https://vercel.com) at
[faura-farmer.vercel.app](https://faura-farmer.vercel.app). Configure the environment
variables from [`.env.example`](.env.example) in the intended Vercel environment before
deploying.

The mobile client is intended for local development and approved Preview or staging
builds. Do not point mobile development builds at the production API. Production database
migrations, environment changes, and deployment remain deliberate release operations.

## Author

**Agustin Ronato Pelicano Jr. (Jay Ar)**, Junior and Full-Stack Software Developer

- GitHub: [@jayarpelicano01](https://github.com/jayarpelicano01)
- LinkedIn: [agustin-pelicano-jr-77062a3a6](https://www.linkedin.com/in/agustin-pelicano-jr-77062a3a6/)
- Email: [jayarpelicano01@gmail.com](mailto:jayarpelicano01@gmail.com)

## License

Released under the [MIT License](LICENSE).
