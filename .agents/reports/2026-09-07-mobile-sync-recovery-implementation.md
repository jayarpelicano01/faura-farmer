# Mobile sync recovery and diagnostics - implementation

- **Worktree / branch:** repository root / `main`
- **Scope:** make authenticated mobile sync failures traceable and preserve local offline data during required reauthentication.

## Changed areas

- Mobile pull and push handlers now catch unexpected failures, log only a generated reference ID, operation, stage, error name, and error code, and return a safe JSON 500 response.
- The mobile client now retains HTTP status, API error code, and server reference IDs instead of replacing every API failure with a generic message.
- An expired or invalid mobile session now removes only the stored session, keeps the SQLite cache and outbox, and sends the user to sign in again. A different account signing in clears the prior account's local data; intentional logout still clears it.

## Result and limitation

- The source implementation is complete. It requires a web deployment before the current APK can receive the safe server response, and a new APK before the improved message and safe reauthentication behavior are installed.
- Production configuration, database state, deployment, and user data were not changed.
