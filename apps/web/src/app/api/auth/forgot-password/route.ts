import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@faura-farmer/database';
import { badRequest, serviceUnavailable, tooManyRequests } from '@/lib/http';
import { sendPasswordResetEmail } from '@/lib/mail';
import { forgotPasswordSchema } from '@/lib/validations';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  readJsonBody,
  requireTrustedOrigin,
} from '@/lib/security';
import { recordSecurityEvent } from '@/lib/security-events';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  const originFailure = requireTrustedOrigin(request);
  if (originFailure) return originFailure;

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = forgotPasswordSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid email');

  const email = parsed.data.email.toLowerCase();
  const rateLimit = await checkRateLimit(
    'password-reset-ip',
    getClientIp(request),
    RATE_LIMITS.passwordResetIp,
  );
  const emailRateLimit = await checkRateLimit(
    'password-reset-email',
    email,
    RATE_LIMITS.passwordResetEmail,
  );
  if (!rateLimit.allowed || !emailRateLimit.allowed) {
    await recordSecurityEvent('rate_limit_blocked', { request });
    const failure = !rateLimit.allowed ? rateLimit : emailRateLimit;
    if ('unavailable' in failure) return serviceUnavailable('Security services are temporarily unavailable');
    return tooManyRequests(
      'Too many reset attempts. Please try again later.',
      'retryAfter' in failure ? failure.retryAfter : undefined,
    );
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.NEXT_PUBLIC_APP_URL) {
    return serviceUnavailable('Password reset is temporarily unavailable');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const token = randomBytes(32).toString('base64url');
    try {
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: tokenHash(token),
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        });
      });
      await sendPasswordResetEmail({ email: user.email, token });
      await recordSecurityEvent('password_reset_requested', { request, userId: user.id });
    } catch (error) {
      console.error('Password reset delivery failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return serviceUnavailable('Password reset is temporarily unavailable');
    }
  }

  return Response.json(
    { message: 'If an account exists for that email, a reset link has been sent.' },
    { status: 200 },
  );
}
