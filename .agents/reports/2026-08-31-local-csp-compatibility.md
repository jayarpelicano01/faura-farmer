# Local CSP compatibility report

Date: 2026-08-31

## Change

The Content-Security-Policy header is now emitted only in production. Next.js development mode uses runtime evaluation for Fast Refresh, which conflicts with the production CSP's intentionally absent `unsafe-eval` source.

## Expected result

After restarting `pnpm dev`, local Fast Refresh can run without a CSP evaluation error. Production continues to send the existing restrictive CSP.

