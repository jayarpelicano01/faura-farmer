# OAuth account-linking implementation report

Date: 2026-08-31

## Scope delivered

- Added `OAuthIdentity` so one user can own independent Google and Facebook provider identities.
- Added short-lived, single-use `OAuthLinkIntent` records and a signed HttpOnly link-intent cookie.
- Added an additive, unapplied Prisma migration that backfills existing non-email legacy provider mappings into `oauth_identities`.
- Changed OAuth sign-in to use provider identities, reject missing emails and matching-email collisions, and avoid automatic linking.
- Added authenticated `POST` and `DELETE /api/profile/connections/:provider` routes, audit events, expiry/replay controls, serializable unlink protection, and session revocation after an unlink.
- Added Profile connection controls, social-button loading/error states, safer auth-error navigation, explicit provider scopes, and provider/Vercel setup documentation.

## Security decisions

- The callback requires Auth.js OAuth state, a valid signed link-intent cookie, and the original active Faura session for the initiating user before it attaches an identity.
- The link-intent update and identity attachment occur in one transaction. A conflicting identity is consumed and rejected rather than reassigned.
- Direct OAuth login can create a new account only when the provider email is present and not already used by any Faura account.
- User legacy `authProvider` and `providerId` remain initial-provider metadata only. JWT `authProvider` is now the method used for the current session.
- Disconnecting an OAuth identity increments `sessionVersion`, ending existing sessions so a removed provider cannot retain access.

## Migration status

`20260831170000_oauth_identities_and_link_intents` was created but not applied to any database. It must be rehearsed on staging after a backup and separately approved before production use.
