# Mobile APK size QA

- **Worktree/branch:** `main` at `3654de7`; implementation changes are uncommitted.
- **Checks run:**
  - `pnpm --filter @faura-farmer/mobile typecheck` passed.
  - Expo prebuild with `FAURA_APK_VARIANT=arm64` generated `reactNativeArchitectures=arm64-v8a`, R8/resource shrinking, and legacy native-library packaging.
  - Expo prebuild with `FAURA_APK_VARIANT=compat` generated `reactNativeArchitectures=armeabi-v7a,arm64-v8a`, R8/resource shrinking, and legacy native-library packaging.
  - Generated Android files were removed after inspection; no generated native directory remains in the worktree.
- **Pending external checks:** Final APK byte size, library contents/compression, installation over version 1, standalone launch, login, biometrics, offline persistence, sync, and logout require the internal EAS artifact and a test device/staging account.
- **Production:** Not touched.

