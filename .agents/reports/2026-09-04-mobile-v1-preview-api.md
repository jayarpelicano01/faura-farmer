# Mobile v1 Preview API Setup

- **Date:** 2026-09-04
- **Scope:** Preview-only mobile API configuration and deployment verification
- **Production touched:** No

## Result

- Added `MOBILE_API_ENABLED=true` and `MOBILE_AUTH_SECRET` to the Vercel Preview
  environment only.
- Redeployed Preview successfully.
- Preview remains protected by Vercel SSO, so it is unsuitable as an APK API endpoint.

## Follow-up

The official v1 APK will use the production API only after the reviewed release branch
is merged and Production receives its separate mobile API flag and secret.
