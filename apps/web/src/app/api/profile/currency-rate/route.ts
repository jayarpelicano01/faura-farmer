import { auth } from '@/lib/auth';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { refreshUsdPerPhp } from '@/lib/currency-preference';
import { guardMutation } from '@/lib/security';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const securityFailure = await guardMutation(request, 'currency-rate-refresh', session.user.id);
  if (securityFailure) return securityFailure;
  try {
    return ok({ preference: await refreshUsdPerPhp(session.user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to refresh the exchange rate.');
  }
}
