# General agent setup workflow

Run this once per project when asked to set up the repository for AI-assisted development. If `agent-context/project-profile.md` already exists and the user did not explicitly request a refresh, report that setup has already run and stop.

This workflow is intentionally vendor-neutral. Do not assume a particular agent, CLI, framework, language, or command system. The current agent should inspect the repository using the tools available in its environment.

Follow the phases in order. Do not modify application code during setup.

## Phase 1 — Scan and analyze

1. Read `AGENTS.md` and any other repository-level instruction files present.
2. Inspect the manifests, source tree, configuration, documentation, and test setup.
3. Create or update `agent-context/project-profile.md` with:
   - technology stack and package boundaries;
   - architecture and layer pattern;
   - state-management approach;
   - naming, styling, error-handling, and data-access conventions;
   - build, test, lint, typecheck, database, and deployment commands;
   - recurring workflows visible in the codebase.
4. Identify what “user-facing” means for each layer:
   - client code: screens, interactions, navigation, and UI states;
   - backend code: requests, middleware, handlers, services, database calls, and responses;
   - mixed repositories: one flow per layer or one flow across the network boundary.
5. Treat the project profile as the source of discovered facts for the later phases.

## Phase 2 — Install the planning workflow

After Phase 1, present the proposed planning workflow and wait for explicit approval before creating or changing `agent-workflows/pm.md`.

The planning workflow must risk-screen every requested change against `agent-context/project-profile.md`:

1. Routine UI, client-helper, non-sensitive Route Handler, and focused-test work may use a short plan containing the goal, scope, risk result, focused checks, and rollback note. It may proceed under the user's task request unless its scope becomes high risk.
2. Financial, auth, database, schema/migration, shared-contract, dependency, environment, CI, and deployment work must use ordered implementation steps, a Mermaid diagram limited to the affected area, the same flow as a plain-text ASCII diagram, and a confidence percentage with reason for every step. Any step below 90% must include the exact clarifying question that would resolve the ambiguity.
3. High-risk work must stop at an explicit user approval gate. Do not edit files, implement code, or delegate high-risk work until the user explicitly approves the plan.
4. The workflow must require immutable implementation, QA, reviewer, and DevOps evidence where the risk lane calls for those roles. It must not create a separate task-status file.

## Phase 3 — Propose project-fit extensions

Using the project profile, propose only extensions that this repository genuinely benefits from:

- reusable skills or checklists in `agent-workflows/skills/`;
- scoped instructions in additional `AGENTS.md` files;
- isolated agent roles in `agent-workflows/agents/`, when the host agent supports them.

Give each proposal a one-line rationale and wait for explicit approval. Do not create speculative infrastructure.

## Phase 4 — Deduplicate

After approved files are created:

1. Read `AGENTS.md`, the project profile, and every file under `agent-workflows/`.
2. Find facts, conventions, or instructions repeated in multiple files.
3. Keep each item in its most specific owner and replace other copies with a short reference.
4. Report exactly what was deduplicated and where it now lives.
