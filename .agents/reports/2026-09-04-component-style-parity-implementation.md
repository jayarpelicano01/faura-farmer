# Component style parity implementation

- Worktree/branch: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer` / `feature/mobile-phase3-delivery`.
- Scope: shared web/mobile control styling only; no data, sync, authentication-flow, API, schema, dependency, environment, deployment, or production changes.
- Changed areas: web semantic CSS tokens; mobile theme, primitives, burger-toggleable navigation sidebar, auth selector, and existing button call sites; `COMPONENT_STYLE_PARITY_SPEC.md`.

Implemented the component style parity specification. The web and mobile destructive tokens now use the approved coral palette and define explicit foreground colors. The obsolete mobile `buttonBackground` token was removed; mobile primary actions now render from the canonical opaque `primarySolid` token. Mobile now distinguishes standard-primary and primary-solid foregrounds so active sidebar rows, selected chips, tabs, avatars, buttons, and badges use the correct color in light and dark themes.

Rebuilt the native shared `Button` around web-equivalent variants: default, destructive, outline, secondary, ghost, link, income, and expense. Buttons now use 6px rounded geometry, Albert Sans 14px medium labels, 16px horizontal padding, a 44px-or-greater native touch target, and a spinner-backed loading state. Existing unlock, create, sync, authentication, cancel, done, destructive, and save call sites use the new API without changing their handlers.

Added native `Badge`, `Separator`, `Spinner`, and animated `Skeleton` primitives. The archived-account label now consumes the shared badge. The authentication selector, fields, and burger-toggleable navigation sidebar now use the matching radii, type scale, active foreground, and navigation metrics. Mobile cards retain the approved 12px radius.

The worktree already contained unrelated uncommitted mobile UI changes. They were preserved; no reset, revert, staging, or production action was performed.
