# Mobile APK size release verification

- **Worktree/branch:** `main` at `3654de7`; implementation changes are uncommitted.
- **Internal EAS build:** `95ef316c-7885-41b7-851b-954a4064cdda`, Android `production`, app build version 2, completed successfully on 2026-09-06.
- **Artifact result:** 21,143,848 bytes (20.16 MiB).
- **Baseline:** Prior internal Android production artifact for app build version 1 was 102,581,753 bytes (97.83 MiB).
- **Reduction:** 81,437,905 bytes, or 79.4%.
- **Artifact inspection:** The APK contains 22 native libraries exclusively under `lib/arm64-v8a/`. Their uncompressed total is 21,609,240 bytes and their compressed archive total is 7,361,330 bytes, confirming the selected ABI and native-library compression.
- **Pending device QA:** Install and smoke-test on an ARM64 Android phone; test registration/login, biometric unlock, offline persistence, synchronization, and logout with a staging account before sharing.
- **Production:** Not deployed and production data was not touched.

