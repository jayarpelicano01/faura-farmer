import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { prisma } from '@faura-farmer/database';
import type { AuthProvider } from '@faura-farmer/types';
import { authConfig } from './auth.config';
import {
  isCurrentAuthProvider,
  isOAuthProvider,
  isOAuthProviderEnabled,
  oauthLinkIntentCookieName,
  readOAuthLinkIntentCookieValue,
} from './oauth';
import { loginSchema } from './validations';
import { checkRateLimit, getClientIp, RATE_LIMITS } from './security';
import { recordSecurityEvent } from './security-events';

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2a$12$D3FEiDkc5z4jFqw7feB5FufZrYAZP3gIqhRI2GEBqGWXqItX4qgOi';

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  sessionVersion: number;
};

type OAuthSignInInput = {
  user: { email?: string | null; name?: string | null; image?: string | null };
  account: { provider: string; providerAccountId: string } | null;
};

function applyAuthUser(
  user: OAuthSignInInput['user'],
  accountUser: AuthUser,
  authProvider: AuthProvider,
) {
  Object.assign(user, {
    id: accountUser.id,
    email: accountUser.email,
    name: accountUser.name ?? accountUser.email.split('@')[0],
    authProvider,
    avatarUrl: accountUser.avatarUrl,
    sessionVersion: accountUser.sessionVersion,
  });
}

function accountUserSelect() {
  return {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    sessionVersion: true,
  } as const;
}

const providers: Provider[] = [
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials, request) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase();
      const rateLimit = await checkRateLimit('login-ip', getClientIp(request), RATE_LIMITS.loginIp);
      const emailRateLimit = await checkRateLimit('login-email', email, RATE_LIMITS.loginEmail);
      if (!rateLimit.allowed || !emailRateLimit.allowed) {
        await recordSecurityEvent('rate_limit_blocked', { request });
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
      const valid = await bcrypt.compare(parsed.data.password, passwordHash);
      if (!user?.passwordHash || !valid) {
        await recordSecurityEvent('login_failed', { request, userId: user?.id });
        return null;
      }

      if (bcrypt.getRounds(user.passwordHash) < PASSWORD_HASH_ROUNDS) {
        const upgradedHash = await bcrypt.hash(parsed.data.password, PASSWORD_HASH_ROUNDS);
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: upgradedHash } });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email.split('@')[0],
        username: user.username,
        authProvider: 'email' as const,
        avatarUrl: user.avatarUrl,
        sessionVersion: user.sessionVersion,
      };
    },
  }),
];

if (isOAuthProviderEnabled('google')) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { scope: 'openid email profile' } },
    }),
  );
}

if (isOAuthProviderEnabled('facebook')) {
  providers.push(
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: { params: { scope: 'email public_profile' } },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn(input) {
      return authorizeOAuthSignIn(input, request);
    },
  },
}));

async function authorizeOAuthSignIn(input: OAuthSignInInput, request?: NextRequest) {
  const { user, account } = input;
  if (!account || account.provider === 'credentials') return true;
  if (!isOAuthProvider(account.provider)) {
    await recordSecurityEvent('oauth_sign_in_failed', { request });
    return false;
  }

  const provider = account.provider;
  const providerAccountId = account.providerAccountId;
  const email = user.email?.trim().toLowerCase();
  if (!providerAccountId || !email) {
    await recordSecurityEvent('oauth_sign_in_failed', { request });
    return false;
  }

  const rawLinkIntent = request?.cookies.get(oauthLinkIntentCookieName())?.value;
  if (rawLinkIntent) {
    const linkIntent = readOAuthLinkIntentCookieValue(rawLinkIntent);
    if (!linkIntent || linkIntent.provider !== provider) {
      await recordSecurityEvent('oauth_link_failed', { request });
      return false;
    }

    // The existing session must still belong to the profile user that initiated
    // the link. A valid cookie alone must never be enough to attach an identity.
    const session = await auth();
    if (
      !session?.user?.id ||
      session.user.id !== linkIntent.userId ||
      !isCurrentAuthProvider(session.user.authProvider)
    ) {
      await recordSecurityEvent('oauth_link_failed', { request, userId: linkIntent.userId });
      return false;
    }

    try {
      const linked = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const consumed = await tx.oAuthLinkIntent.updateMany({
          where: {
            id: linkIntent.intentId,
            userId: linkIntent.userId,
            provider,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) return { status: 'invalid_intent' as const };

        const targetUser = await tx.user.findUnique({
          where: { id: linkIntent.userId },
          select: accountUserSelect(),
        });
        if (!targetUser) return { status: 'invalid_intent' as const };

        const existingIdentity = await tx.oAuthIdentity.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId } },
        });
        if (existingIdentity && existingIdentity.userId !== targetUser.id) {
          return { status: 'identity_in_use' as const };
        }
        if (!existingIdentity) {
          await tx.oAuthIdentity.create({
            data: { userId: targetUser.id, provider, providerAccountId },
          });
        }
        return { status: 'linked' as const, user: targetUser };
      });

      if (linked.status !== 'linked') {
        await recordSecurityEvent('oauth_link_failed', { request, userId: linkIntent.userId });
        return false;
      }

      applyAuthUser(user, linked.user, session.user.authProvider);
      await recordSecurityEvent('oauth_identity_linked', { request, userId: linked.user.id });
      return true;
    } catch (error) {
      console.error('OAuth identity link failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      await recordSecurityEvent('oauth_link_failed', { request, userId: linkIntent.userId });
      return false;
    }
  }

  try {
    const identity = await prisma.oAuthIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: { select: accountUserSelect() } },
    });
    if (identity) {
      applyAuthUser(user, identity.user, provider);
      await recordSecurityEvent('oauth_signed_in', { request, userId: identity.user.id });
      return true;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      await recordSecurityEvent('oauth_sign_in_failed', { request, userId: existingEmail.id });
      return false;
    }

    const created = await prisma.user.create({
      data: {
        email,
        name: user.name?.trim() || null,
        avatarUrl: user.image ?? null,
        // Retained only as legacy/initial-provider metadata. New decisions use
        // oauth_identities and passwordHash instead.
        authProvider: provider,
        providerId: providerAccountId,
        oauthIdentities: { create: { provider, providerAccountId } },
      },
      select: accountUserSelect(),
    });
    applyAuthUser(user, created, provider);
    await recordSecurityEvent('oauth_signed_in', { request, userId: created.id });
    return true;
  } catch (error) {
    console.error('OAuth sign-in failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    await recordSecurityEvent('oauth_sign_in_failed', { request });
    return false;
  }
}
