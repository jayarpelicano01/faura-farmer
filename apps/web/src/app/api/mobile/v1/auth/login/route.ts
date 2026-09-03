import { z } from 'zod';
import { prisma } from '@faura-farmer/database';
import { loginSchema } from '@/lib/validations';
import { badRequest, serviceUnavailable, tooManyRequests, unauthorized } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { createMobileSession, maybeUpgradePasswordHash, passwordMatches } from '@/lib/mobile/auth';
import { recordSecurityEvent } from '@/lib/security-events';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';

const inputSchema = loginSchema.extend({ deviceId: z.string().trim().min(16).max(128) });

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const body = await readJsonBody(request, 16 * 1024);
  if ('response' in body) return body.response;
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  const email = parsed.data.email.toLowerCase();
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit('mobile-login-ip', getClientIp(request), RATE_LIMITS.loginIp),
    checkRateLimit('mobile-login-email', email, RATE_LIMITS.loginEmail),
  ]);
  const limited = !ipLimit.allowed ? ipLimit : emailLimit;
  if (!limited.allowed) {
    await recordSecurityEvent('rate_limit_blocked', { request });
    return 'unavailable' in limited
      ? serviceUnavailable('Security services are temporarily unavailable')
      : tooManyRequests('Too many login attempts. Please try again later.', limited.retryAfter);
  }
  const user = await prisma.user.findUnique({
    where: { email }, select: { id: true, email: true, name: true, passwordHash: true, sessionVersion: true },
  });
  const valid = await passwordMatches(parsed.data.password, user?.passwordHash);
  if (!user?.passwordHash || !valid) {
    await recordSecurityEvent('mobile_login_failed', { request, userId: user?.id });
    return unauthorized();
  }
  await maybeUpgradePasswordHash(user.id, user.passwordHash, parsed.data.password);
  await recordSecurityEvent('mobile_signed_in', { request, userId: user.id });
  return Response.json(await createMobileSession(user, parsed.data.deviceId));
}
