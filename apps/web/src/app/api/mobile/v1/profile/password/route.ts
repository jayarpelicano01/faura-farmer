import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { badRequest, ok, serviceUnavailable, tooManyRequests, unauthorized } from '@/lib/http';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { recordSecurityEvent } from '@/lib/security-events';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';
import { changePasswordSchema } from '@/lib/validations';

const PASSWORD_HASH_ROUNDS = 12;

export async function POST(request: Request) {
  if (!mobileApiIsEnabled()) return mobileApiDisabledResponse();
  const mobileUser = await authenticateMobileRequest(request);
  if (!mobileUser) return unauthorized();

  const limited = await checkRateLimit('mobile-password-change', `${mobileUser.id}:${getClientIp(request)}`, RATE_LIMITS.passwordChange);
  if (!limited.allowed) {
    if ('unavailable' in limited) return serviceUnavailable('Password updates are temporarily unavailable');
    return tooManyRequests('Too many password updates. Please try again later.', limited.retryAfter);
  }

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = changePasswordSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');

  const user = await prisma.user.findUnique({ where: { id: mobileUser.id }, select: { id: true, passwordHash: true } });
  if (!user) return unauthorized();
  if (!user.passwordHash) return badRequest('Password change is not available for this account');

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return badRequest('Current password is incorrect');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, PASSWORD_HASH_ROUNDS),
      sessionVersion: { increment: 1 },
    },
  });
  await recordSecurityEvent('password_changed', { request, userId: user.id });
  return ok({ message: 'Password updated. Please sign in again.' }, { headers: { 'Cache-Control': 'private, no-store' } });
}
