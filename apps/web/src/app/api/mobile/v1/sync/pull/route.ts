import { mobileSyncPullSchema } from '@faura-farmer/types';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { pullMobileChanges } from '@/lib/mobile/sync';

export async function GET(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const user = await authenticateMobileRequest(request);
  if (!user) return unauthorized();
  const parsed = mobileSyncPullSchema.safeParse({ cursor: new URL(request.url).searchParams.get('cursor') ?? '0' });
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid cursor');
  return ok(await pullMobileChanges(user.id, parsed.data.cursor));
}
