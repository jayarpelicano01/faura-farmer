# Fix Mobile Offline/Online Workspace Switching

> **Status:** Ready for implementation.
> **Scope:** Fix infinite loop crash, Gate redirect bug, and wrong "Switch to online" behavior. Introduce `'offline'` session status.

## 1. Problem Statement

The mobile app's offline/online workspace system has three issues:

1. **Infinite loop crash**: Switching between offline and online mode triggers a "Maximum update depth exceeded" React error. The root cause is a feedback cycle in the More screen's `loadProfile` function: it depends on `session`, calls `activeSession()` which may refresh the token via `update()`, changing `session`, which recreates `loadProfile`, which re-fires the effect in an endless loop.

2. **Gate redirect bug**: The `Gate` component (router guard) sees `status === 'signedOut'` when in local-only mode and redirects the user back to the welcome screen. This works by accident due to React render timing but is architecturally fragile and can fail.

3. **Wrong "Switch to online" behavior**: When a local-only user taps "Switch to online", the app calls `signOutLocal()` which clears the online database cache and session. Since local-only users have no session and the local data should be preserved (it's a separate, independent account), this is incorrect. The button should just switch the workspace pointer and navigate to login.

Additionally, the codebase has several unnecessary re-render sources: `WorkspaceProvider` reads `useSession()` but never uses the values, `Gate` reads `activeWorkspace` but never uses it, and `CurrencyProvider` toggles its `ready` flag twice on every database change.

## 2. Solution

Introduce an `'offline'` session status that is semantically distinct from `'signedOut'`. When a user enters local-only mode, the session status becomes `'offline'` (meaning "no server session, but actively using the app locally"). The Gate renders the app shell for `'offline'` status. The "Switch to online" button simply switches the workspace pointer without clearing any data. Profile editing works for local-only users with email and username fields hidden.

## 3. User Stories

1. As a new user, I want to tap "Use offline" on the welcome screen and start using the app immediately without registering, so that I can try the app before committing to an account.
2. As a local-only user, I want to see the same screens as an online user (dashboard, transactions, budgets, accounts, reports, more), so that I have full app functionality.
3. As a local-only user, I want sync-related UI (sync button, data-and-sync card) hidden, so that I'm not confused by features that don't apply to me.
4. As a local-only user, I want to edit my display name in the Profile section, so that I can set up my identity on the device.
5. As a local-only user, I want the email and username fields hidden in the profile form, so that I'm not prompted for information that doesn't apply.
6. As a local-only user, I want to tap "Switch to online" and be taken to the login screen, so that I can sign in with a real account.
7. As a local-only user, I want my local data to remain intact after switching to online, so that if I switch back to offline later, my data is still there.
8. As a local-only user, I want to tap "Log out" and have my local data cleared, so that I can start fresh or hand the device to someone else.
9. As a signed-in user, I want to lose connectivity temporarily and still log expenses, so that I don't lose data during network interruptions.
10. As a signed-in user who goes offline, I want changes queued in the outbox and synced automatically when connectivity returns, so that my data is preserved without manual intervention.
11. As a signed-in user, I want to see a quiet offline indicator (CloudOff icon) when connectivity is lost, so that I know my changes are saved locally but not yet synced.
12. As a signed-in user, I want the app to detect network restoration and trigger sync automatically, so that I don't have to manually initiate sync.
13. As a signed-in user, I want the app to sync when it returns to the foreground, so that stale data is refreshed.
14. As a user switching from offline to online mode, I want the transition to be instant without error toasts or loading states, so that the experience feels seamless.
15. As a developer, I want the `Gate` component to correctly handle all session statuses (loading, covered, locked, offline, signedOut, ready), so that navigation works reliably.
16. As a developer, I want the `WorkspaceProvider` to not re-render unnecessarily when session status changes, so that the app performs well.
17. As a developer, I want the `loadProfile` function to be immune to feedback loops, so that the app doesn't crash with "Maximum update depth exceeded."
18. As a developer, I want clear semantic separation between "no session, using locally" (`offline`) and "no session, not using the app" (`signedOut`), so that the codebase is maintainable.

## 4. Implementation Decisions

### 4.1 Session status model

Add `'offline'` to the session status union type. The status transitions become:

- `loading` -> `ready` (normal sign-in flow)
- `loading` -> `offline` (local-only mode detected on cold launch)
- `loading` -> `signedOut` (no session, no local workspace)
- `signedOut` -> `offline` (user taps "Use offline")
- `offline` -> `signedOut` (user taps "Log out" in local mode)
- `offline` -> `ready` (user signs in from local mode)
- `ready` -> `signedOut` (user signs out, or session expires and is not refreshed)
- `ready` -> `locked` (app backgrounded, lock delay elapsed)
- `locked` -> `ready` (user unlocks)

Export a `setOffline()` function from the session module that the welcome/login/register screens can call to transition `signedOut` -> `offline`. Export a `clearOffline()` function for the reverse.

### 4.2 Gate routing logic

The Gate component checks statuses in this order:
1. `loading` -> show spinner
2. `covered` -> show privacy cover
3. `locked` -> show lock screen
4. `offline` -> render `<AppShell><Slot /></AppShell>` (local-only users see the app)
5. `signedOut` -> redirect to `/welcome` unless already on an auth page
6. `ready` -> render `<AppShell><Slot /></AppShell>`

Remove the unused `activeWorkspace` read from Gate.

### 4.3 WorkspaceProvider cleanup

Remove the dead `const { session, status } = useSession()` from WorkspaceProvider. These values were destructured but never referenced, causing unnecessary re-renders of the entire provider subtree.

### 4.4 Enter offline mode flow

The welcome, login, and register screens call `enterOfflineMode()` (from WorkspaceProvider) then call `setOffline()` (from SessionProvider) then navigate to `/dashboard`. This replaces the current flow where `enterOfflineMode()` alone was insufficient because it didn't update session status.

### 4.5 Switch to online flow

The "Switch to online" button on the More screen calls `resetToOnline()` (switches workspace pointer to `'online'`) then navigates to `/login`. It does NOT call `signOutLocal()`. Local data remains in `faura-farmer-local.db`.

### 4.6 Log out flow for local users

The `logout` function checks `activeWorkspace`. If `'local'`, it calls `deleteLocalProfile()` (clears local DB, resets workspace to online) then navigates to `/welcome`. If `'online'`, it follows the existing online logout flow (server logout, clear session, navigate to welcome).

### 4.7 Infinite loop fix

Two changes in the More screen:

1. **InFlight guard**: Add a `useRef<boolean>` guard to `loadProfile` that prevents concurrent/re-entrant execution. If `loadProfile` is already running, subsequent calls return immediately.

2. **Ref-based session access in `activeSession`**: Change `activeSession` to read `session` from a ref instead of the closure. This gives `activeSession` a stable reference (only depends on `update`), breaking the chain where `session` change -> `activeSession` new reference -> `loadProfile` new reference -> effect re-fires.

### 4.8 Profile UI for local users

In the More screen's profile card:
- Name field: always visible and editable
- Email field: hidden when `activeWorkspace === 'local'`
- Username field: hidden when `activeWorkspace === 'local'`
- The `saveProfile` function already has a local workspace branch that saves to the local database without making API calls

### 4.9 CurrencyProvider ready flag

The CurrencyProvider effect sets `ready` to false then true on every `db` change. This is unnecessary for local-only users since the profile is already cached. Add an early return for the local workspace case: if workspace is local, load the profile from local DB and set ready without the false-true toggle.

## 5. Testing Decisions

### 5.1 What makes a good test

Tests should verify external behavior (state transitions, UI rendering, data persistence) rather than implementation details (internal refs, callback references). The key behaviors to test are:
- Session status transitions between all valid states
- Gate routing for each session status
- Workspace switching preserves or clears data as expected
- `loadProfile` does not re-execute when session changes mid-flight
- Profile fields render/hide based on workspace

### 5.2 Modules to test

1. **Session status transitions** (new): Unit tests for `setOffline()`, `clearOffline()`, and the status state machine. Similar to the existing `tokens.test.ts` pattern.
2. **Gate routing**: Component test verifying correct rendering for each status. No existing component tests in the mobile app, so this would be the first.
3. **loadProfile inFlight guard**: Unit test verifying that concurrent calls are deduplicated. Similar pattern to the `inFlight` guard in `sync.ts`.

### 5.3 Prior art

- `apps/mobile/src/sync/sync.ts` has the `inFlight` guard pattern for deduplication
- `apps/web/src/lib/mobile/tokens.test.ts` tests token issuance and verification
- `apps/web/src/lib/validations.test.ts` tests schema validation
- No React component tests exist in the mobile app currently

## 6. Out of Scope

- **Local-to-server data migration**: A feature allowing local-only users to "upgrade" to an online account and upload their local data. This is a separate, larger feature.
- **Automatic offline fallback for signed-in users**: The current outbox-based sync already handles this. No changes needed.
- **Conflict resolution**: When two devices edit the same record offline. This is a separate concern.
- **Offline currency rate refresh**: The "Refresh rate" button is already correctly hidden in offline mode. No fallback exchange rate is needed.
- **Session expiry during offline mode**: The existing behavior (401 triggers `requireReauthentication()`) is correct and unchanged.

## 7. Further Notes

The two use cases (local-only account vs. signed-in user going temporarily offline) are architecturally distinct:
- **Local-only**: Separate database (`faura-farmer-local.db`), no session, no sync, placeholder profile. The workspace switch is a permanent lifestyle choice.
- **Signed-in offline**: Same database (`faura-farmer.db`), has session, outbox queues changes, sync runs when connectivity returns. The offline state is temporary.

The current code conflates these by using workspace switching for both. This spec fixes the local-only flow. The signed-in offline flow already works correctly via the outbox pattern and needs no changes.

## 8. Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/src/auth/session.tsx` | Add `'offline'` status, add `setOffline()` and `clearOffline()` functions |
| `apps/mobile/app/_layout.tsx` | Gate handles `offline` status, remove unused `activeWorkspace` read |
| `apps/mobile/src/data/workspace-provider.tsx` | Remove dead `useSession()` read |
| `apps/mobile/app/(auth)/welcome.tsx` | Call `setOffline()` after `enterOfflineMode()` |
| `apps/mobile/app/(auth)/login.tsx` | Call `setOffline()` after `enterOfflineMode()` |
| `apps/mobile/app/(auth)/register.tsx` | Call `setOffline()` after `enterOfflineMode()` |
| `apps/mobile/app/(tabs)/more.tsx` | Fix infinite loop, fix "Switch to online" button, fix "Log out" for local users, adjust profile UI |
| `apps/mobile/src/ui/currency.tsx` | Skip ready toggle for local workspace |
