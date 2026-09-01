# Authentication operations runbook

This runbook covers the email/password and Google sign-in release. Facebook remains disabled.

## Credential exposure and rotation

Treat any credential placed in a tracked file, console output, issue, or chat transcript as exposed.

1. In Upstash, reset or revoke the affected REST credential and obtain a replacement standard REST token.
2. In Vercel, update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for Production, then redeploy.
3. Confirm `https://faura-farmer.vercel.app/api/auth/providers` returns HTTP 200 after the deployment. Registration and login may return HTTP 503 while the rate-limit service is unavailable; this is intentional fail-closed behavior.
4. Replace committed values with empty sample placeholders and record the incident without putting credential material into reports.

Because a reset revokes the old Upstash token, schedule this as a brief maintenance window. Do not make a password, API token, database URL containing credentials, provider secret, or service-role key public.

## Production configuration checklist

In Vercel Production, confirm without copying values into source control:

- `AUTH_SECRET` is stable across deployments.
- `DATABASE_URL` and `DIRECT_URL` point to the intended production database.
- The Upstash REST URL and standard token are present and current.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_ENABLED=true`, and `NEXT_PUBLIC_APP_URL=https://faura-farmer.vercel.app` are set.
- Facebook variables and `NEXT_PUBLIC_FACEBOOK_ENABLED` stay unset or disabled until its provider launch is approved.

Vercel environment changes require a new deployment. Google must also have the exact production callback URI `https://faura-farmer.vercel.app/api/auth/callback/google` registered.

## Google acceptance checklist

Use dedicated test accounts and do not place their passwords in tickets or reports.

| Scenario | Expected result |
| --- | --- |
| New Google email | A new Faura account and Google identity are created; a second login returns to the same account. |
| Existing password email | Direct Google login is rejected without revealing account details or linking the identity. |
| Explicit connection | A signed-in password user can connect Google from **Profile → Sign-in methods** and then sign in with Google. |
| Disconnect | Removing Google ends active sessions and is refused when it would remove the final sign-in method. |
| Replayed or expired link flow | The callback rejects it and leaves provider identities unchanged. |
| Consent denial or provider failure | The user sees a safe sign-in error; no account or connection is changed. |

## Health checks and incident triage

- Check `/api/auth/providers`: it must list `credentials` and `google`.
- Check Vercel Function Logs for Auth.js, Prisma, or `Rate limit service failed` errors.
- Review Supabase `security_events` for `oauth_signed_in`, `oauth_sign_in_failed`, `oauth_identity_linked`, `oauth_identity_unlinked`, `oauth_link_failed`, and `rate_limit_blocked` entries. The application stores only a hashed client IP.
- Check the Upstash dashboard for request errors and usage limits.
- For a bad application deployment, roll back the Vercel deployment. Do not roll back the additive Prisma schema automatically.

