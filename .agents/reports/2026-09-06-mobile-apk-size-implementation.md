# Mobile APK size implementation

- **Worktree/branch:** `main` at `3654de7`; implementation changes are uncommitted.
- **Scope:** Reduce the direct-download Android APK while retaining mobile functionality.
- **Changed areas:** Added SDK-55-compatible `expo-build-properties`; added dynamic Expo configuration for ABI-specific release settings; added an ARM64 main build and ARM32/ARM64 fallback build; increased Android `versionCode` to 2; replaced the size-reduction specification.
- **Configuration:** ARM64 builds use `arm64-v8a`; compatibility builds use `armeabi-v7a,arm64-v8a`. Both enable R8, resource shrinking, and `expo.useLegacyPackaging`.
- **Result:** Implementation is complete locally. No mobile UI, API, database, authentication, or financial-behaviour code changed.
- **Production:** Not touched. An internal EAS build was initiated separately for artifact verification.

