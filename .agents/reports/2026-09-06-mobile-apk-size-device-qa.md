# Mobile APK size device QA availability

- **Worktree/branch:** `main` at `3654de7`; implementation changes are uncommitted.
- **Check run:** Android Debug Bridge started successfully and reported no connected devices.
- **Result:** APK installation and device smoke tests could not run in this session because no Android phone was attached or paired.
- **Required follow-up:** Install the ARM64 APK on the Redmi Note 14 4G, then verify standalone launch, registration/login, biometric unlock, offline persistence, synchronization, and logout using a staging account.
- **Production:** Not touched.

