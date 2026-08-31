import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody, RATE_LIMITS } from '@/lib/security';
import { recordSecurityEvent } from '@/lib/security-events';

const PASSWORD_HASH_ROUNDS = 12;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(
    request,
    'password-change',
    session.user.id,
    RATE_LIMITS.passwordChange,
  );
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = changePasswordSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) {
    return badRequest('Password change is not available for this account');
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, PASSWORD_HASH_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  await recordSecurityEvent('password_changed', { request, userId: user.id });

  return ok({ message: 'Password updated. Please sign in again.' });
}
