# Mobile v1 APK Build Failure

- **Date:** 2026-09-04
- **Build ID:** `1627654b-5050-4205-aaac-b44bad8c6dfb`
- **Profile:** `production`
- **Production touched:** No

## Result

The first Android APK build failed in Gradle while evaluating
`react-native-reanimated` because `react-native-worklets` was not a direct mobile
dependency. Reanimated resolves that package from the app dependency graph during
the native build.

## Incidental diagnostics

- The app icon was non-square (`693x696`), which failed Expo config validation.
- Expo Router peers `expo-constants` and `expo-linking` were missing.
- Expo Doctor also reported the approved Metro override and two non-blocking patch
  version advisories.

## Follow-up

An approved build-fix branch adds the required direct peers and a square icon before
resubmitting an APK build.
