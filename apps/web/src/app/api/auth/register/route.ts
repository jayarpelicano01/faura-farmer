import bcrypt from 'bcryptjs';
import { prisma } from '@faura-farmer/database';
import { registerSchema } from '@/lib/validations';
import { badRequest, serviceUnavailable, tooManyRequests } from '@/lib/http';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody, requireTrustedOrigin } from '@/lib/security';
import { recordSecurityEvent } from '@/lib/security-events';

const PASSWORD_HASH_ROUNDS = 12;

export async function POST(request: Request) {
  const originFailure = requireTrustedOrigin(request);
  if (originFailure) return originFailure;

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if ('response' in bodyResult) return bodyResult.response;
  const body = bodyResult.data;
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const email = parsed.data.email.toLowerCase();
  const rateLimit = await checkRateLimit('registration', getClientIp(request), RATE_LIMITS.registration);
  if (!rateLimit.allowed) {
    await recordSecurityEvent('rate_limit_blocked', { request });
    if ('unavailable' in rateLimit) {
      return serviceUnavailable('Security services are temporarily unavailable');
    }
    return tooManyRequests('Too many registration attempts. Please try again later.', rateLimit.retryAfter);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return badRequest('Unable to create an account with those details');
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        authProvider: 'email',
        name: parsed.data.name?.trim() || null,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return badRequest('Unable to create an account with those details');
    }
    throw error;
  }
}
