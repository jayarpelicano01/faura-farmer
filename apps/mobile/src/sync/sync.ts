import type { MobileSyncChange, MobileSyncMutation } from '@faura-farmer/types';
import { getCursor, outboxBatch, reconcileChanges, resolveOutbox, takeLastSyncError } from '@/data/db';
import { getStoredSession, type StoredSession } from '@/auth/session';
import { mobileRequest, refreshedSession } from './api';

let inFlight: Promise<{ warning: string | null }> | null = null;

function needsRefresh(session: StoredSession) {
  return new Date(session.accessTokenExpiresAt).getTime() - Date.now() < 60_000;
}

export async function synchronize(onSessionRefreshed: (next: StoredSession) => Promise<void>) {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    let session = await getStoredSession();
    if (!session) throw new Error('Sign in to synchronize');
    if (needsRefresh(session)) {
      session = await refreshedSession(session);
      await onSessionRefreshed(session);
    }

    while (true) {
      const mutations = await outboxBatch();
      if (mutations.length === 0) break;
      const pushed = await mobileRequest<{ results: Array<{ mutationId: string; status: 'accepted' | 'rejected'; message?: string }> }>(
        '/api/mobile/v1/sync/push',
        { method: 'POST', body: JSON.stringify({ baseCursor: await getCursor(), mutations: mutations as MobileSyncMutation[] }) },
        session.accessToken,
      );
      await resolveOutbox(pushed.results);
    }

    let more = true;
    while (more) {
      const pulled = await mobileRequest<{ cursor: string; changes: MobileSyncChange[]; hasMore: boolean }>(
        `/api/mobile/v1/sync/pull?cursor=${encodeURIComponent(await getCursor())}`,
        {},
        session.accessToken,
      );
      await reconcileChanges(pulled.changes, pulled.cursor);
      more = pulled.hasMore;
    }
    return { warning: await takeLastSyncError() };
  })().finally(() => { inFlight = null; });
  return inFlight;
}
