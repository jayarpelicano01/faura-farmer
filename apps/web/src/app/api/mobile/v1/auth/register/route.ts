import { z } from 'zod';
import { prisma } from '@faura-farmer/database';
import { registerSchema } from '@/lib/validations';
import { badRequest, created, serviceUnavailable, tooManyRequests } from '@/lib/http';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { createMobileSession, hashPassword } from '@/lib/mobile/auth';
import { recordSecurityEvent } from '@/lib/security-events';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';

const inputSchema = registerSchema.and(z.object({ deviceId: z.string().trim().min(16).max(128) }));

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const body = await readJsonBody(request, 16 * 1024);
  if ('response' in body) return body.response;
  const parsed = inputSchema.safeParse(body.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  const limited = await checkRateLimit('mobile-registration', getClientIp(request), RATE_LIMITS.registration);
  if (!limited.allowed) {
    await recordSecurityEvent('rate_limit_blocked', { request });
    return 'unavailable' in limited
      ? serviceUnavailable('Security services are temporarily unavailable')
      : tooManyRequests('Too many registration attempts. Please try again later.', limited.retryAfter);
  }
  const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return badRequest('Unable to create an account with those details');
  }
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(parsed.data.password), authProvider: 'email', name: parsed.data.name?.trim() || null },
      select: { id: true, email: true, name: true, sessionVersion: true },
    });
    await recordSecurityEvent('mobile_registered', { request, userId: user.id });
    return created(await createMobileSession(user, parsed.data.deviceId));
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return badRequest('Unable to create an account with those details');
    throw error;
  }
}
