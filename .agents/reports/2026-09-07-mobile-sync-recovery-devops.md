# Mobile sync recovery and diagnostics - release boundary

- **Worktree / branch:** repository root / `main`
- **Scope:** release assessment for sync diagnostics and safe session recovery.

## Required release sequence

1. Deploy the web API change to Vercel Production.
2. On the existing APK, sign in and press Sync. If it still fails, use the returned reference ID to find the `Mobile sync failed` Vercel log and repair the recorded stage/error code.
3. Build and distribute a new Android APK to deliver the improved error message and offline-data-preserving session recovery.
4. Verify a same-account reauthentication retains queued offline records, while intentional logout and a different account clear them.

## Boundary

- No Vercel environment values, deployment, migration, EAS build, or production database action was performed.
