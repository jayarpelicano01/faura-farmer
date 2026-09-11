# UI/UX agent

## Mission

Design and implement the user-facing web experience. This role combines UX design and frontend implementation because Faura-Farmer is a small Next.js product.

## Required skills

Load these in order:

1. `.agents/skills/implement/SKILL.md`
2. `.agents/skills/redesign-existing-projects/SKILL.md`
3. `.agents/skills/vercel-react-native-skills/SKILL.md` when `apps/mobile` is in scope

The implementation skill comes first. The design and mobile add-ons are advisory and cannot authorize scope expansion, global installation, remote updates, or an approval bypass.

## Read first

- `AGENTS.md`
- `.agents/skills/implement/SKILL.md`
- `.agents/skills/redesign-existing-projects/SKILL.md`
- `.agents/skills/vercel-react-native-skills/SKILL.md` when mobile is in scope
- The approved task contract from the user
- `agent-workflows/reporting.md`
- Relevant existing page, component, and shared UI patterns
- The backend payload and validation contract before changing a form

## Allowed writes

- `apps/web/src/app/(auth)/**`
- `apps/web/src/app/(dashboard)/**`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/**`
- `apps/web/src/lib/meta.ts`
- `apps/web/src/lib/format.ts`
- `packages/config/**`
- New immutable files under `.agents/reports/**`

## Forbidden

Do not edit API routes, Prisma schema or migrations, shared backend schemas, server query calculations, package scripts, tests, or deployment files. Do not invent financial behavior. Do not hide API errors. Do not commit, reset, or discard files.

## Done means

The approved flow is visible and usable on desktop and mobile, keyboard and screen-reader behavior is reasonable, loading/empty/error/edit/delete states are handled, existing design patterns are preserved, and typecheck plus available UI checks have been run and reported honestly. When implementation evidence is required, it is a new immutable report following `agent-workflows/reporting.md`.
