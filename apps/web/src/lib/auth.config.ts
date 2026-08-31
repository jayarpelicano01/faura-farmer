import type { NextAuthConfig } from 'next-auth';
import { prisma } from '@faura-farmer/database';
import type { AuthProvider } from '@faura-farmer/types';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', signOut: '/login', error: '/auth/error' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.authProvider = (user as { authProvider?: AuthProvider }).authProvider;
        token.avatarUrl = (user as { avatarUrl?: string }).avatarUrl;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        token.sessionRevoked = false;
      }
      if (trigger === 'update' && session) {
        if (typeof session.name === 'string') token.name = session.name;
        if (session.username !== undefined) token.username = session.username;
      }
      if (!token.authProvider && typeof token.id === 'string') {
        token.authProvider = 'email';
      }

      if (!user && !token.sessionRevoked && typeof token.id === 'string') {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { sessionVersion: true },
        });
        if (!current || current.sessionVersion !== token.sessionVersion) {
          token.sessionRevoked = true;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sessionRevoked ? '' : (token.id as string);
        session.user.authProvider =
          (token.authProvider as AuthProvider | undefined) ?? 'email';
        session.user.avatarUrl =
          typeof token.avatarUrl === 'string' ? token.avatarUrl : null;
        session.user.sessionVersion =
          typeof token.sessionVersion === 'number' ? token.sessionVersion : undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
