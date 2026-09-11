import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { useWorkspace } from '@/data/workspace-provider';
import { mobileRequest } from '@/sync/api';

export function useLogout(activeSession: () => Promise<{ accessToken: string; refreshToken: string }>) {
  const router = useRouter();
  const { clearOffline, session, signOutLocal } = useSession();
  const { activeWorkspace, deleteLocalProfile } = useWorkspace();

  return useCallback(async () => {
    if (activeWorkspace === 'local') {
      await deleteLocalProfile();
      clearOffline();
      router.replace('/welcome');
      return;
    }
    try {
      if (session) {
        const active = await activeSession();
        await mobileRequest('/api/mobile/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: active.refreshToken }) }, active.accessToken);
      }
    } catch {
      // Local logout still protects cached data when the server is unavailable.
    } finally {
      await signOutLocal();
      router.replace('/welcome');
    }
  }, [activeSession, activeWorkspace, clearOffline, deleteLocalProfile, router, session, signOutLocal]);
}
