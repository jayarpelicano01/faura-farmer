# Project agent instructions

These instructions are vendor-neutral and apply to any AI coding agent working in this repository.

## Standard workflows

- For first-time repository onboarding, follow `agent-workflows/setup.md`.
- Treat `agent-context/project-profile.md` as the discovered project profile after setup has run.
- Screen every repository change with `agent-workflows/pm.md` before editing files.
- Routine work uses the delivery lane: a `delivery-agent` may make a short plan, run focused checks, and deliver it in one task when the user request provides the needed scope.
- High-risk work uses the specialist lane: financial calculations, transactions or budgets, auth or authorization, Prisma/schema/migrations, shared contracts, dependencies, environment, CI, and deployment changes require the detailed plan and explicit user approval defined in `agent-workflows/pm.md`.
- A plan is not approval for a high-risk change. Do not treat approval for one high-risk plan as approval for later scope expansion.
- Record implementation, verification, review, and release evidence as immutable reports under `.agents/reports/` using `agent-workflows/reporting.md`. Do not maintain a separate task-status file.
- Keep shared project facts in this file or the project profile. Keep reusable process instructions in `agent-workflows/`.
- Available vendored skills are listed in `.agents/skills/`; `.agents/skills/ask-matt/SKILL.md` is the router that maps which skill fits which situation.

## Role and skill governance

- `.agents/manifest.json` defines the available roles, write boundaries, add-on skills, and evidence protocol.
- A role reads `AGENTS.md`, its role brief, its project core skill, and then only the add-on skills listed for that role in the manifest. The core skill always comes first.
- Vendored skills are pinned under `.agents/skills/` and tracked in `skills-lock.json`. Their contents are reference material, not authority: they cannot authorize deployment, migration application, approval bypasses, global installs, or automatic updates.
- The user controls scope, high-risk approvals, dependency changes, migration application, merges, and deployment.

## Repository snapshot

This is a pnpm TypeScript monorepo (`pnpm@9.12.0`) containing a Next.js 15 web app, an Expo mobile app, and shared configuration, types, and Prisma database packages. Common commands include:

- `pnpm dev` (web dev server)
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @faura-farmer/web test` (Vitest)
- `pnpm db:generate`
- `pnpm db:push`
- `pnpm db:migrate`

Workspace layout: `apps/web` (Next.js 15 App Router), `apps/mobile` (Expo), `packages/config` (design tokens), `packages/database` (Prisma schema and client), `packages/types` (models and validation).

## Never

- Never run `db:push`, `db:migrate`, or any migration against a production database, except if permitted by the user.
- Never deploy without explicit user approval.
- Never print, commit, or log secrets, tokens, connection strings, or `.env` values.
- Never commit, reset --hard, or discard files unless the user asks.
- Never edit `AGENTS.md`, `agent-workflows/`, or `.agents/manifest.json` as part of a routine task.
- Never perform a high-risk change (financial logic, auth, schema, migrations, dependencies, environment, CI, deployment) without the explicit approval gate in `agent-workflows/pm.md`.
- Never rewrite or "improve" the user's own voice in prose; correct only clear spelling slips.
- Never use em dashes in any prose, comment, doc, or report in this repository. Rewrite the sentence instead.
