import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '@/auth/session';
import { useWorkspace } from '@/data/workspace-provider';
import { MobileApiError, MobileConnectionError, isMobileUnauthorized } from './api';
import { synchronize } from './sync';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'offline' | 'attention';

type SyncContextValue = {
  lastSyncFailed: boolean;
  syncing: boolean;
  syncMessage: string | null;
  syncNow: (manual?: boolean) => Promise<void>;
  syncStatus: SyncStatus;
};

const SyncContext = createContext<SyncContextValue | null>(null);
const OFFLINE_MESSAGE = 'Changes saved here. Sync when online.';
const RESULT_STATUS_DURATION_MS = 5_000;

function messageFor(error: unknown) {
  if (error instanceof MobileConnectionError && error.problem === 'server_unavailable') return OFFLINE_MESSAGE;
  if (error instanceof MobileApiError) {
    if (error.status === 401) return 'Your session ended. Sign in again to restore your offline data.';
    if (error.requestId || error.code === 'SYNC_PULL_FAILED' || error.code === 'SYNC_PUSH_FAILED') {
      return `Sync server error. Reference: ${error.requestId ?? 'unavailable'}.`;
    }
    return error.message;
  }
  return 'Sync needs attention. Your changes stay on this device.';
}

export function SyncProvider({ children }: PropsWithChildren) {
  const { status, update, requireReauthentication } = useSession();
  const { activeWorkspace } = useWorkspace();
  const [lastSyncFailed, setLastSyncFailed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = useCallback((nextStatus: SyncStatus, message: string | null, duration?: number) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setSyncStatus(nextStatus);
    setSyncMessage(message);
    resetTimer.current = duration
      ? setTimeout(() => {
        setSyncStatus('idle');
        setSyncMessage(null);
        resetTimer.current = null;
      }, duration)
      : null;
  }, []);

  const syncNow = useCallback(async (manual = false) => {
    if (status !== 'ready' || activeWorkspace !== 'online' || syncingRef.current) return;
    syncingRef.current = true;
    if (manual) setLastSyncFailed(false);
    showStatus('syncing', 'Syncing...');
    try {
      const connection = await NetInfo.fetch();
      if (connection.isConnected === false) {
        setLastSyncFailed(true);
        showStatus('offline', OFFLINE_MESSAGE, RESULT_STATUS_DURATION_MS);
        return;
      }
      const result = await synchronize(update);
      if (result.warning) {
        setLastSyncFailed(true);
        showStatus('attention', result.warning, RESULT_STATUS_DURATION_MS);
      } else {
        setLastSyncFailed(false);
        showStatus('success', 'Synced', RESULT_STATUS_DURATION_MS);
      }
    } catch (error) {
      setLastSyncFailed(true);
      if (isMobileUnauthorized(error)) {
        await requireReauthentication();
        return;
      }
      showStatus(error instanceof MobileConnectionError && error.problem === 'server_unavailable' ? 'offline' : 'attention', messageFor(error), RESULT_STATUS_DURATION_MS);
    } finally {
      syncingRef.current = false;
    }
  }, [activeWorkspace, requireReauthentication, showStatus, status, update]);

  useEffect(() => {
    if (status !== 'ready') {
      setLastSyncFailed(false);
      showStatus('idle', null);
      return;
    }
    void syncNow();
    const net = NetInfo.addEventListener((state) => { if (state.isConnected) void syncNow(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void syncNow(); });
    return () => { net(); app.remove(); };
  }, [showStatus, status, syncNow]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const value = useMemo(() => ({
    lastSyncFailed,
    syncing: syncStatus === 'syncing',
    syncMessage,
    syncNow,
    syncStatus,
  }), [lastSyncFailed, syncMessage, syncNow, syncStatus]);

  return createElement(SyncContext.Provider, { value }, children);
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used inside SyncProvider');
  return context;
}
