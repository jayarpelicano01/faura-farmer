import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { clearLocalData, saveProfile } from '@/data/db';

const SESSION_KEY = 'mobile-session-v1';
const INSTALLATION_KEY = 'mobile-installation-id-v1';

export type StoredSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null };
};

type SessionContextValue = {
  status: 'loading' | 'signedOut' | 'locked' | 'ready';
  session: StoredSession | null;
  deviceId: string | null;
  unlock: () => Promise<boolean>;
  establish: (session: StoredSession) => Promise<void>;
  update: (session: StoredSession) => Promise<void>;
  signOutLocal: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export async function getStoredSession() {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  return stored ? (JSON.parse(stored) as StoredSession) : null;
}

export async function getInstallationId() {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing) return existing;
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(INSTALLATION_KEY, value);
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionContextValue['status']>('loading');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getStoredSession(), getInstallationId()]).then(([stored, installation]) => {
      setSession(stored);
      setDeviceId(installation);
      setStatus(stored ? 'locked' : 'signedOut');
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && session) setStatus('locked');
    });
    return () => subscription.remove();
  }, [session]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Faura Farmer',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'strong',
    });
    if (result.success) setStatus('ready');
    return result.success;
  }, []);

  const establish = useCallback(async (next: StoredSession) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    await saveProfile(next.user);
    setSession(next);
    setStatus('ready');
  }, []);

  const update = useCallback(async (next: StoredSession) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOutLocal = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearLocalData();
    setSession(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(() => ({ status, session, deviceId, unlock, establish, update, signOutLocal }), [status, session, deviceId, unlock, establish, update, signOutLocal]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
