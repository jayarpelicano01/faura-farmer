import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import bcrypt from 'bcryptjs';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { prisma } from '@faura-farmer/database';
import type { AuthProvider } from '@faura-farmer/types';
import { authConfig } from './auth.config';
import { loginSchema } from './validations';
import { checkRateLimit, getClientIp, RATE_LIMITS } from './security';
import { recordSecurityEvent } from './security-events';

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = '$2a$12$D3FEiDkc5z4jFqw7feB5FufZrYAZP3gIqhRI2GEBqGWXqItX4qgOi';

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
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        sessionVersion: user.sessionVersion,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (!account || account.provider === 'credentials') return true;
      if (account.provider !== 'google' && account.provider !== 'facebook') {
        await recordSecurityEvent('oauth_sign_in_failed');
        return false;
      }

      const provider = account.provider as AuthProvider;
      const providerId = account.providerAccountId;
      const email = user.email?.trim().toLowerCase();
      if (!providerId || !email) {
        await recordSecurityEvent('oauth_sign_in_failed');
        return false;
      }

      try {
        const identity = await prisma.user.findUnique({
          where: { authProvider_providerId: { authProvider: provider, providerId } },
        });
        if (identity) {
          Object.assign(user, {
            id: identity.id,
            email: identity.email,
            name: identity.name,
            authProvider: identity.authProvider,
            avatarUrl: identity.avatarUrl,
            sessionVersion: identity.sessionVersion,
          });
          return true;
        }

        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
          await recordSecurityEvent('oauth_sign_in_failed', { userId: existingEmail.id });
          return false;
        }

        const created = await prisma.user.create({
          data: {
            email,
            name: user.name?.trim() || null,
            avatarUrl: user.image ?? null,
            authProvider: provider,
            providerId,
          },
        });
        Object.assign(user, {
          id: created.id,
          email: created.email,
          name: created.name,
          authProvider: created.authProvider,
          avatarUrl: created.avatarUrl,
          sessionVersion: created.sessionVersion,
        });
        return true;
      } catch (error) {
        console.error('OAuth sign-in failed', { error: error instanceof Error ? error.message : 'unknown' });
        await recordSecurityEvent('oauth_sign_in_failed');
        return false;
      }
    },
  },
});
