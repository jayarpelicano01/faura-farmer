import { mobileSyncPullSchema } from '@faura-farmer/types';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { pullMobileChanges } from '@/lib/mobile/sync';
import { mobileSyncFailure } from '@/lib/mobile/sync-failure';

export async function GET(request: Request) {
  let stage: 'availability' | 'authentication' | 'validation' | 'change_feed' = 'availability';
  try {
    if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
    stage = 'authentication';
    const user = await authenticateMobileRequest(request);
    if (!user) return unauthorized();
    stage = 'validation';
    const parsed = mobileSyncPullSchema.safeParse({ cursor: new URL(request.url).searchParams.get('cursor') ?? '0' });
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid cursor');
    stage = 'change_feed';
    return ok(await pullMobileChanges(user.id, parsed.data.cursor));
  } catch (error) {
    return mobileSyncFailure('pull', stage, error);
  }
}
