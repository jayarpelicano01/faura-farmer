import type { DefaultSession } from 'next-auth';
import type { AuthProvider } from '@faura-farmer/types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      authProvider: AuthProvider;
      avatarUrl?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    authProvider?: AuthProvider;
    avatarUrl?: string | null;
  }
}