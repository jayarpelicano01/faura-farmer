# Faura Farmer mobile (Phase 3)

This Expo Router workspace is local-first. Accounts, categories, transactions,
tombstones, the sync cursor, and outbox mutations live in SQLite; only opaque refresh
tokens and access-session metadata use Expo SecureStore. The app asks the operating
system for biometric authentication with device-passcode fallback whenever it returns
from the background.

## Development boundary

Set `EXPO_PUBLIC_API_URL` to a local server or an approved Vercel Preview URL. The
client rejects `https://faura-farmer.vercel.app`; do not point development builds at
Production. The corresponding web environment must set `MOBILE_API_ENABLED=true` and
must be local development or Vercel Preview. `MOBILE_AUTH_SECRET` is a separate,
32+-character staging secret.

Run `pnpm --filter @faura-farmer/mobile start` after dependencies are installed. Use a
development build for iOS Face ID testing; Expo Go cannot exercise that path reliably.

## Sync ordering

Each local CRUD write and outbox entry is committed together. Sync refreshes tokens
when needed, pushes FIFO mutation IDs, records accepted or rejected receipts, pulls
canonical changes, then reconciles the SQLite tables and cursor in one transaction.
Deleted records remain as local tombstones until canonical changes are applied, so a
stale device cannot recreate a deleted record with the old ID.
