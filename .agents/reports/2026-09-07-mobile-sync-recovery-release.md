# Mobile sync recovery and diagnostics - production release

- **Worktree / branch:** repository root / `main`
- **Release commit:** `6e21d57` (`fix(mobile): make sync failures recoverable`)

## Delivery

- Pushed the reviewed commit to `origin/main`, the repository's configured Vercel Production deployment path.
- No Prisma migration, production database mutation, or Vercel environment-variable change was included.

## Post-push health check

- `GET https://faura-farmer.vercel.app/api/mobile/v1/sync/pull?cursor=0` returned the expected unauthenticated `401` JSON response, confirming the public mobile route remains enabled and reachable.

## Remaining acceptance

- An authenticated device Sync must be attempted after the deployment. Any remaining server failure will return the new safe response and log `Mobile sync failed` with a generated request ID, operation, stage, and error code.
- The existing APK will receive the server-side error handling; a new APK is still needed for the improved mobile error message and offline-data-preserving session recovery.
