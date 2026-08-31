import { Prisma, prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { badRequest, fail, notFound, ok, serviceUnavailable, unauthorized } from '@/lib/http';
import {
  canUnlinkOAuthIdentity,
  createOAuthLinkIntentCookieValue,
  isOAuthLinkIntentSigningConfigured,
  isOAuthProvider,
  isOAuthProviderEnabled,
  OAUTH_LINK_INTENT_MAX_AGE_SECONDS,
  oauthLinkIntentCookieName,
  oauthLinkIntentCookieOptions,
} from '@/lib/oauth';
import { guardMutation, RATE_LIMITS } from '@/lib/security';
import { recordSecurityEvent } from '@/lib/security-events';

const LINK_INTENT_DURATION_MS = OAUTH_LINK_INTENT_MAX_AGE_SECONDS * 1000;

async function resolveProvider(params: Promise<{ provider: string }>) {
  const { provider } = await params;
  return isOAuthProvider(provider) ? provider : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = await resolveProvider(params);
  if (!provider || !isOAuthProviderEnabled(provider)) {
    return badRequest('This sign-in provider is not available');
  }
  if (!isOAuthLinkIntentSigningConfigured()) {
    return serviceUnavailable('Sign-in linking is temporarily unavailable');
  }

  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(
    request,
    'oauth-link-intent',
    session.user.id,
    RATE_LIMITS.oauthLink,
  );
  if (securityFailure) return securityFailure;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LINK_INTENT_DURATION_MS);
  const intent = await prisma.$transaction(async (tx) => {
    await tx.oAuthLinkIntent.updateMany({
      where: {
        userId: session.user.id,
        provider,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    return tx.oAuthLinkIntent.create({
      data: { userId: session.user.id, provider, expiresAt },
    });
  });

  const cookieValue = createOAuthLinkIntentCookieValue({
    intentId: intent.id,
    userId: session.user.id,
    provider,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
  });
  if (!cookieValue) {
    await prisma.oAuthLinkIntent.update({ where: { id: intent.id }, data: { usedAt: now } });
    return serviceUnavailable('Sign-in linking is temporarily unavailable');
  }

  const response = ok({ provider, expiresAt: expiresAt.toISOString() });
  response.cookies.set({
    name: oauthLinkIntentCookieName(),
    value: cookieValue,
    ...oauthLinkIntentCookieOptions,
  });
  await recordSecurityEvent('oauth_link_intent_created', { request, userId: session.user.id });
  return response;
}

export async function DELETE(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const provider = await resolveProvider(params);
  if (!provider) return notFound('Connection not found');

  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(
    request,
    'oauth-connection-delete',
    session.user.id,
    RATE_LIMITS.oauthLink,
  );
  if (securityFailure) return securityFailure;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: session.user.id },
            select: { passwordHash: true },
          });
          if (!user) return { status: 'not_found' as const };

          const identity = await tx.oAuthIdentity.findFirst({
            where: { userId: session.user.id, provider },
            select: { id: true },
          });
          if (!identity) return { status: 'not_found' as const };

          const identityCount = await tx.oAuthIdentity.count({
            where: { userId: session.user.id },
          });
          if (!canUnlinkOAuthIdentity(Boolean(user.passwordHash), identityCount)) {
            return { status: 'last_sign_in_method' as const };
          }

          await tx.oAuthIdentity.delete({ where: { id: identity.id } });
          await tx.user.update({
            where: { id: session.user.id },
            data: { sessionVersion: { increment: 1 } },
          });
          return { status: 'deleted' as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result.status === 'not_found') return notFound('Connection not found');
      if (result.status === 'last_sign_in_method') {
        return badRequest('Connect another sign-in method before removing this connection');
      }

      await recordSecurityEvent('oauth_identity_unlinked', { request, userId: session.user.id });
      return ok({ provider, deleted: true, signInRequired: true });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2034') continue;
      throw error;
    }
  }

  return fail('Your connections changed. Refresh the page and try again.', 409, 'OAUTH_CONNECTION_CONFLICT');
}
