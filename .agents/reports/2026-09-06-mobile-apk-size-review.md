# Mobile APK size review

- **Worktree/branch:** `main` at `3654de7`; implementation changes are uncommitted.
- **Review scope:** Expo configuration, EAS profile inheritance, dependency version, generated Gradle properties, and unrelated-file isolation.
- **Result:** `expo-build-properties@~55.0.18` matches the installed Expo SDK. `production` resolves to ARM64 only and `production-compat` resolves to both ARM ABIs. The configuration generates the intended `reactNativeArchitectures`, `android.enableMinifyInReleaseBuilds`, `android.enableShrinkResourcesInReleaseBuilds`, and `expo.useLegacyPackaging` properties. Expo prebuild's unrelated script rewrites were reverted.
- **Known risk:** R8 must pass installed-app smoke testing. Compressed native libraries reduce APK download bytes but may increase installed storage because Android extracts them.
- **Production:** Not touched.

