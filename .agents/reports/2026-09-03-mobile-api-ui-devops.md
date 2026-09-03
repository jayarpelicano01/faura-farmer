# Mobile API and web-aligned UI DevOps evidence

- Worktree/branch: `main`, `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`.
- Production touched: no. No Vercel CLI invocation, deployment, production variable change, Prisma push, Prisma migrate, or database query was run.

The workspace lockfile now pins the recovered Expo SDK 55 mobile stack and direct `expo-font` dependency. Two OFL-licensed variable fonts are vendored as mobile app assets; their use is validated by the Android Metro export. The existing favicon stays a single web-owned source rather than an alternate mobile redesign.

The mobile app's only public configuration is `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` in ignored `apps/mobile/.env.local`. Database URLs and auth material stay out of the mobile workspace; the local web server's mobile enablement and generated local secret are in ignored `apps/web/.env.local` and are not reported.

`pnpm install` reported one non-blocking peer warning: mobile React `19.2.0` versus a web-only `react-dom` peer at `19.2.8`. Mobile typecheck and Android export passed with that existing workspace split. Before any Preview/staging release, follow `docs/mobile-staging.md`; migration application and Preview variable provisioning remain user-controlled operations.
