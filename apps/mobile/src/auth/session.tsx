import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { clearLocalData, getProfile, saveProfile } from '@/data/db';
import { getActiveWorkspaceId } from '@/data/workspace';

const SESSION_KEY = 'mobile-session-v1';
const INSTALLATION_KEY = 'mobile-installation-id-v1';
const LOCK_DELAY_KEY = 'mobile-lock-delay-v1';
const BACKGROUND_TIME_KEY = 'mobile-background-time-v1';

export const LOCK_DELAY_OPTIONS = [1, 5, 15, 30] as const;
export type LockDelayMinutes = (typeof LOCK_DELAY_OPTIONS)[number];
const DEFAULT_LOCK_DELAY: LockDelayMinutes = 15;

export type StoredSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null };
};

export type SessionStatus = 'loading' | 'signedOut' | 'covered' | 'locked' | 'ready' | 'offline';

type SessionContextValue = {
  status: SessionStatus;
  session: StoredSession | null;
  deviceId: string | null;
  unlock: () => Promise<boolean>;
  establish: (session: StoredSession) => Promise<void>;
  update: (session: StoredSession) => Promise<void>;
  authNotice: string | null;
  requireReauthentication: () => Promise<void>;
  signOutLocal: () => Promise<void>;
  setOffline: () => void;
  clearOffline: () => void;
  lockDelay: LockDelayMinutes;
  setLockDelay: (minutes: LockDelayMinutes) => Promise<void>;
  unlockNow: () => void;
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

async function getLockDelay(): Promise<LockDelayMinutes> {
  const stored = await SecureStore.getItemAsync(LOCK_DELAY_KEY);
  if (!stored) return DEFAULT_LOCK_DELAY;
  const parsed = Number(stored);
  if (LOCK_DELAY_OPTIONS.includes(parsed as LockDelayMinutes)) return parsed as LockDelayMinutes;
  return DEFAULT_LOCK_DELAY;
}

async function getBackgroundTime(): Promise<number | null> {
  const stored = await SecureStore.getItemAsync(BACKGROUND_TIME_KEY);
  if (!stored) return null;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : null;
}

async function saveBackgroundTime(time: number) {
  await SecureStore.setItemAsync(BACKGROUND_TIME_KEY, String(time));
}

async function clearBackgroundTime() {
  await SecureStore.deleteItemAsync(BACKGROUND_TIME_KEY);
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionContextValue['status']>('loading');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [lockDelay, setLockDelayState] = useState<LockDelayMinutes>(DEFAULT_LOCK_DELAY);

  useEffect(() => {
    void Promise.all([getStoredSession(), getInstallationId(), getLockDelay(), getActiveWorkspaceId()]).then(([stored, installation, delay, workspace]) => {
      setSession(stored);
      setDeviceId(installation);
      setLockDelayState(delay);
      if (!stored) {
        if (workspace === 'local') {
          setStatus('offline');
        } else {
          setStatus('signedOut');
        }
        return;
      }
      // Cold launch: check if delay has elapsed since last background
      void checkColdLaunchLock(delay);
    });
  }, []);

  const checkColdLaunchLock = async (delay: LockDelayMinutes) => {
    const bgTime = await getBackgroundTime();
    if (!bgTime) {
      // No background time recorded — start locked (fresh install or signed out previously)
      setStatus('locked');
      return;
    }
    const elapsed = Date.now() - bgTime;
    const delayMs = delay * 60 * 1000;
    if (elapsed >= delayMs) {
      // Delay elapsed — require biometric unlock
      await clearBackgroundTime();
      setStatus('locked');
    } else {
      // Delay not elapsed — safe to show content
      await clearBackgroundTime();
      setStatus('ready');
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (!session) return;
      if (next !== 'active') {
        // App backgrounded or inactive — show privacy cover immediately and save time
        saveBackgroundTime(Date.now());
        setStatus('covered');
      } else {
        // App resumed — check if delay has elapsed
        void resumeCheck();
      }
    });
    return () => subscription.remove();
  }, [session, lockDelay]);

  const resumeCheck = async () => {
    const bgTime = await getBackgroundTime();
    if (!bgTime) {
      // No background time — just go ready
      setStatus('ready');
      return;
    }
    const elapsed = Date.now() - bgTime;
    const delayMs = lockDelay * 60 * 1000;
    if (elapsed >= delayMs) {
      // Delay elapsed — require biometric unlock
      setStatus('locked');
    } else {
      // Delay not elapsed — safe to resume
      await clearBackgroundTime();
      setStatus('ready');
    }
  };

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Faura Farmer',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      biometricsSecurityLevel: 'strong',
    });
    if (result.success) {
      await clearBackgroundTime();
      setStatus('ready');
    }
    return result.success;
  }, []);

  const unlockNow = useCallback(() => {
    void clearBackgroundTime();
    setStatus('ready');
  }, []);

  const establish = useCallback(async (next: StoredSession) => {
    const cachedProfile = await getProfile();
    if (cachedProfile && cachedProfile.id !== next.user.id) await clearLocalData();
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    await saveProfile(next.user);
    setSession(next);
    setAuthNotice(null);
    setStatus('ready');
  }, []);

  const update = useCallback(async (next: StoredSession) => {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOutLocal = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearLocalData();
    await clearBackgroundTime();
    setSession(null);
    setAuthNotice(null);
    setStatus('signedOut');
  }, []);

  const requireReauthentication = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await clearBackgroundTime();
    setSession(null);
    setAuthNotice('Your session ended. Sign in again to restore your offline data.');
    setStatus('signedOut');
  }, []);

  const setOffline = useCallback(() => {
    setStatus('offline');
  }, []);

  const clearOffline = useCallback(() => {
    setStatus('signedOut');
  }, []);

  const setLockDelay = useCallback(async (minutes: LockDelayMinutes) => {
    await SecureStore.setItemAsync(LOCK_DELAY_KEY, String(minutes));
    setLockDelayState(minutes);
  }, []);

  const value = useMemo(() => ({
    status, session, deviceId, unlock, establish, update, authNotice, requireReauthentication, signOutLocal,
    setOffline, clearOffline, lockDelay, setLockDelay, unlockNow,
  }), [status, session, deviceId, unlock, establish, update, authNotice, requireReauthentication, signOutLocal, setOffline, clearOffline, lockDelay, setLockDelay, unlockNow]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
