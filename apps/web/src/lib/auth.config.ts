import type { NextAuthConfig } from 'next-auth';
import type { AuthProvider } from '@faura-farmer/types';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', signOut: '/login', error: '/auth/error' },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.authProvider = (user as { authProvider?: AuthProvider }).authProvider;
        token.avatarUrl = (user as { avatarUrl?: string }).avatarUrl;
      }
      if (trigger === 'update' && session) {
        if (typeof session.name === 'string') token.name = session.name;
        if (session.username !== undefined) token.username = session.username;
      }
      if (!token.authProvider && typeof token.id === 'string') {
        token.authProvider = 'email';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.authProvider =
          (token.authProvider as AuthProvider | undefined) ?? 'email';
        session.user.avatarUrl =
          typeof token.avatarUrl === 'string' ? token.avatarUrl : null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;