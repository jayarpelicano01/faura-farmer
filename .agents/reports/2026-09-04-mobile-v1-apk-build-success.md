# Mobile v1 Android APK Build Success

- **Date:** 2026-09-04
- **Source:** `main` via PR #3
- **EAS build:** `75b2d199-316a-41fd-b02a-18666fd8fdac`
- **Profile:** `production`
- **Distribution:** Internal APK

## Result

EAS Build completed successfully for the official Android application.

- Package: `com.faura.farmer`
- Version: `1.0.0` (Android version code `1`)
- Source commit: `22ee0bb603629009a30bf10b05c210eab3b9d05a`
- APK: `https://expo.dev/artifacts/eas/zcQggVcOnpQ89Lio7tPT7YFsnFZrPUXcYREeEUoGxIM.apk`
- Artifact expiry: 2026-09-18 13:18 UTC

## Build timing

- Submitted: 2026-09-04 13:18 UTC
- Completed: 2026-09-04 14:47 UTC
- Queue time: approximately 69 minutes
- Build duration: approximately 20 minutes

## Prior failure resolved

The initial Android build could not resolve `react-native-worklets` from
`react-native-reanimated`. PR #3 added the required direct native dependencies
and Android icon; the corrected build completed successfully.

## Remaining verification

The APK is ready for device download and installation. Device installation and
post-install production sync verification have not been performed in this
build environment.
