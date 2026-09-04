import { z } from 'zod';
import { badRequest, serviceUnavailable, tooManyRequests, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { rotateMobileSession } from '@/lib/mobile/auth';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';

const inputSchema = z.object({ refreshToken: z.string().min(40).max(256), deviceId: z.string().trim().min(16).max(128) }).strict();

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const body = await readJsonBody(request, 16 * 1024);
  if ('response' in body) return body.response;
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  const limited = await checkRateLimit('mobile-refresh', getClientIp(request), RATE_LIMITS.mutation);
  if (!limited.allowed) {
    return 'unavailable' in limited
      ? serviceUnavailable('Security services are temporarily unavailable')
      : tooManyRequests('Too many refresh attempts. Please try again later.', limited.retryAfter);
  }
  const session = await rotateMobileSession(parsed.data.refreshToken, parsed.data.deviceId);
  return session ? Response.json(session) : unauthorized();
}
