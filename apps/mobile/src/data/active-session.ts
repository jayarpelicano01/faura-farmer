import type { StoredSession } from '@/auth/session';
import { refreshedSession } from '@/sync/api';

/** Return a usable session, refreshing it when it expires within one minute. */
export async function activeSession(
  session: StoredSession | null,
  update: (next: StoredSession) => Promise<void>,
): Promise<StoredSession> {
  if (!session) throw new Error('Your session has ended');
  if (new Date(session.accessTokenExpiresAt).getTime() - Date.now() >= 60_000) return session;

  const next = await refreshedSession(session);
  await update(next);
  return next;
}
