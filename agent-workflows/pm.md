# Change risk workflow

Screen each change against `agent-context/project-profile.md` before editing. Routine
UI and isolated client helpers may use a short goal/scope/risk/check/rollback plan.

Financial behaviour, authentication or authorization, database schema or migrations,
shared contracts, dependencies, environment, CI, and deployment are high risk. They
require an ordered plan with Mermaid and ASCII affected-flow diagrams, a confidence
and reason for every step, and explicit user approval before implementation. A later
scope expansion requires new approval.

For Phase 3, the user supplied the ordered, diagrammed high-risk plan and explicitly
requested its implementation. Its boundary is the `feature/mobile-phase3` worktree,
local development, and Preview/staging only. Production changes, deployment, and
migration application are excluded unless separately approved.

High-risk deliveries record immutable implementation, QA, review, and release evidence
under `.agents/reports/` following `agent-workflows/reporting.md`.
