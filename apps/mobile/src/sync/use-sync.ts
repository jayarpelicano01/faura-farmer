import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '@/auth/session';
import { synchronize } from './sync';

export function useSync() {
  const { status, update } = useSession();
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const syncNow = useCallback(async (showErrors = false) => {
    if (status !== 'ready' || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await synchronize(update);
      if (result.warning) Alert.alert('A change needs attention', result.warning);
    } catch (error) {
      if (showErrors) Alert.alert('Sync unavailable', error instanceof Error ? error.message : 'Try again when online.');
    } finally { syncingRef.current = false; setSyncing(false); }
  }, [status, update]);

  useEffect(() => {
    if (status !== 'ready') return;
    void syncNow();
    const net = NetInfo.addEventListener((state) => { if (state.isConnected) void syncNow(); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') void syncNow(); });
    return () => { net(); app.remove(); };
  }, [status, syncNow]);
  return { syncing, syncNow };
}
