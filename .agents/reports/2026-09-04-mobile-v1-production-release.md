# Mobile v1 Production Release

- **Date:** 2026-09-04
- **Release branch:** `release/mobile-v1`
- **Pull request:** `#2`, merged into `main`
- **Merge commit:** `09c5b4b3dfe1395ae95ec4a73b3382df93e2f669`
- **Production touched:** Yes

## Production configuration

- Added `MOBILE_API_ENABLED=true` to Vercel Production.
- Added a dedicated `MOBILE_AUTH_SECRET` to Vercel Production as a secret.
- Confirmed Production Upstash rate-limit variables remain configured.
- Redeployed the merged production build and confirmed it was aliased to
  `https://faura-farmer.vercel.app`.

## Verification

- `GET /api/mobile/v1/sync/pull` without a bearer token returns HTTP `401`.
- The production Vercel deployment reports success.

## APK build

- EAS Build ID: `1627654b-5050-4205-aaac-b44bad8c6dfb`
- Profile: `production`
- Target: Android internal APK, `com.faura.farmer`, version `1.0.0`, build `1`
- Status at report time: queued

## Rollback

Set `MOBILE_API_ENABLED=false` in Vercel Production and redeploy to disable the
mobile API without changing the web application or removing the additive schema.
