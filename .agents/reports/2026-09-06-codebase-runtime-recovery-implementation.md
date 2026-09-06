# Codebase runtime recovery - implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** Restore generated Next build metadata after the interrupted development cache left route manifests missing.
- **Changed areas:** Regenerated the ignored `apps/web/.next` build output with a finite production build; no tracked application source, schema, dependency, or environment files changed for this recovery.
- **Result:** `routes-manifest.json`, `middleware-manifest.json`, and generated route types are present again, resolving the observed `ENOENT` failures.
- **Known limitations:** Vitest remains unable to initialize under Node 22.8.0 because Rolldown 1.2.6 requires Node 20.19+ or 22.12+.
- **Production:** Not touched.