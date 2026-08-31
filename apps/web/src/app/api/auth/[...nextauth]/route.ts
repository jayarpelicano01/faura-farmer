import { handlers } from '@/lib/auth';
import { clearOAuthLinkIntentCookieHeader, oauthLinkIntentCookieName } from '@/lib/oauth';
import { requireTrustedOrigin } from '@/lib/security';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  const isOAuthCallback = /\/api\/auth\/callback\/(google|facebook)$/.test(
    request.nextUrl.pathname,
  );
  if (isOAuthCallback && request.cookies.has(oauthLinkIntentCookieName())) {
    response.headers.append('Set-Cookie', clearOAuthLinkIntentCookieHeader());
  }
  return response;
}

export async function POST(request: NextRequest) {
  const originFailure = requireTrustedOrigin(request);
  if (originFailure) return originFailure;
  return handlers.POST(request);
}
