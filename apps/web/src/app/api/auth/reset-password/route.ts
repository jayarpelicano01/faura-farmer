import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { badRequest, ok } from '@/lib/http';
import { resetPasswordSchema } from '@/lib/validations';
import { getClientIp, guardMutation, readJsonBody, RATE_LIMITS } from '@/lib/security';
import { recordSecurityEvent } from '@/lib/security-events';

const PASSWORD_HASH_ROUNDS = 12;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  const securityFailure = await guardMutation(
    request,
    'password-reset-completion',
    getClientIp(request),
    RATE_LIMITS.passwordResetIp,
  );
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = resetPasswordSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid reset request');
  }

  const hash = tokenHash(parsed.data.token);
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, PASSWORD_HASH_ROUNDS);
  const now = new Date();
  const reset = await prisma.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findFirst({
      where: { tokenHash: hash, usedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true },
    });
    if (!token) return null;

    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId: token.userId } });
    return token;
  });

  if (!reset) return badRequest('This password reset link is invalid or has expired');
  await recordSecurityEvent('password_reset_completed', { request, userId: reset.userId });
  return ok({ message: 'Password updated. Please sign in with your new password.' });
}
