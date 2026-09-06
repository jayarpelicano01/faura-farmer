# Codebase runtime recovery - DevOps

- **Worktree / branch:** repository root / `main`
- **Scope:** Local process and generated-build recovery.
- **Actions:** Stopped the leftover Expo and Metro development processes, then completed finite typecheck and production-build checks only.
- **Current state:** No Expo or Next development server is running from this workspace.
- **Known limitation:** System Node must be updated to at least 22.12.0 (or use 20.19.0+) before Vitest can load its required Rolldown native binding.
- **Production:** Not touched.