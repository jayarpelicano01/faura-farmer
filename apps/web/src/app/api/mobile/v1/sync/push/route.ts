import { mobileSyncPushSchema } from '@faura-farmer/types';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { processMobileMutation } from '@/lib/mobile/sync';
import { mobileSyncFailure } from '@/lib/mobile/sync-failure';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';

export async function POST(request: Request) {
  let stage: 'availability' | 'authentication' | 'rate_limit' | 'validation' | 'mutation' = 'availability';
  try {
    if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
    stage = 'authentication';
    const user = await authenticateMobileRequest(request);
    if (!user) return unauthorized();
    stage = 'rate_limit';
    const limited = await checkRateLimit('mobile-sync-push', `${user.id}:${getClientIp(request)}`, RATE_LIMITS.mutation);
    if (!limited.allowed) return badRequest('Sync is temporarily rate limited');
    stage = 'validation';
    const body = await readJsonBody(request);
    if ('response' in body) return body.response;
    const parsed = mobileSyncPushSchema.safeParse(body.data);
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid sync request');
    stage = 'mutation';
    const results = [];
    for (const mutation of parsed.data.mutations) results.push(await processMobileMutation(user.id, mutation));
    return ok({ results });
  } catch (error) {
    return mobileSyncFailure('push', stage, error);
  }
}
