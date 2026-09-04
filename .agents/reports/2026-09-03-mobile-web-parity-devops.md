# Mobile web-parity redesign — DevOps evidence

- Worktree: `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`
- Dependency hygiene: `lucide-react-native` and `react-native-svg` are direct dependencies of `apps/mobile`, satisfying Expo monorepo native dependency ownership; their resolved versions are pinned in `pnpm-lock.yaml`.
- Native configuration: Expo is set to dark appearance and embeds the existing app font assets through `expo-font` for native builds. Android icon metadata remains tied to the shared web favicon.
- Local developer handoff: restart Expo with cache clearing after this navigation/dependency change; a clean Android native rebuild is required to observe the font-plugin/native dependency configuration outside Expo Go.
- Release boundary: no environment files, secrets, database URLs, Supabase settings, Vercel settings, production deployment, or migration application was changed.
