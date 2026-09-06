import { badRequest, ok, serviceUnavailable, tooManyRequests, unauthorized } from '@/lib/http';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { refreshUsdPerPhp } from '@/lib/currency-preference';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/security';

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const user = await authenticateMobileRequest(request);
  if (!user) return unauthorized();
  const limited = await checkRateLimit('mobile-currency-rate-refresh', `${user.id}:${getClientIp(request)}`, RATE_LIMITS.mutation);
  if (!limited.allowed) return 'unavailable' in limited ? serviceUnavailable('Rate refresh is temporarily unavailable') : tooManyRequests('Too many rate refreshes. Please try again later.', limited.retryAfter);
  try {
    return ok({ preference: await refreshUsdPerPhp(user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to refresh the exchange rate.');
  }
}
