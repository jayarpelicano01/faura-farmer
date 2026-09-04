# Mobile v1 Implementation

- **Date:** 2026-09-04
- **Branch:** `release/mobile-v1`
- **Scope:** Official sideloaded Android v1 configuration and production mobile API enablement
- **Production touched:** No

## Changes

- Configured EAS project `@jayaruuu/faura-farmer` and an internal Android APK profile.
- Set Android package `com.faura.farmer`, version `1.0.0`, and version code `1`.
- Allowed the mobile client to use its configured production HTTPS API.
- Changed the server gate to require `MOBILE_API_ENABLED=true` and a dedicated
  `MOBILE_AUTH_SECRET` in every environment, including Production.
- Removed the mobile token fallback to `AUTH_SECRET`.
- Included approved Metro monorepo resolver and dashboard metric adjustments.

## Limitations

The configured Android icon is the existing 693x696 favicon rather than a recommended
1024x1024 square asset. It remains user-approved for this v1 build.
