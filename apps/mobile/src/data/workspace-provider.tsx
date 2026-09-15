import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { MobileProfile } from '@faura-farmer/types';
import { createDatabase, type DatabaseHandle } from '@/data/db';
import {
  ONLINE_WORKSPACE,
  LOCAL_WORKSPACE,
  LOCAL_PROFILE_ID,
  type WorkspaceId,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from '@/data/workspace';
import { isOfflineBuild } from '@/config/app-mode';

type WorkspaceContextValue = {
  activeWorkspace: WorkspaceId;
  db: DatabaseHandle;
  profile: MobileProfile | null;
  onlineDb: DatabaseHandle;
  localDb: DatabaseHandle;
  enterOfflineMode: () => Promise<void>;
  resetToOnline: () => Promise<void>;
  createLocalProfile: () => Promise<void>;
  deleteLocalProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  localProfileExists: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const onlineDb = createDatabase(ONLINE_WORKSPACE.databaseName);
const localDb = createDatabase(LOCAL_WORKSPACE.databaseName);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('online');
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [localProfileExists, setLocalProfileExists] = useState(false);
  const [ready, setReady] = useState(false);

  const ensureLocalProfile = useCallback(async () => {
    const existing = await localDb.getProfileDetails();
    if (existing) {
      setProfile(existing);
      setLocalProfileExists(true);
      return existing;
    }
    const localProfile = {
      id: LOCAL_PROFILE_ID,
      email: '',
      name: 'Local',
      username: null,
      hasPassword: false,
      displayCurrency: 'PHP',
      usdPerPhp: null,
      rateDate: null,
      rateRefreshedAt: null,
    } satisfies MobileProfile;
    await localDb.saveProfileDetails(localProfile);
    setProfile(localProfile);
    setLocalProfileExists(true);
    return localProfile;
  }, []);

  useEffect(() => {
    void (async () => {
      if (!isOfflineBuild) await onlineDb.initializeDatabase();
      await localDb.initializeDatabase();
      if (isOfflineBuild) {
        await ensureLocalProfile();
        setActiveWorkspace('local');
        setReady(true);
        return;
      }
      const stored = await getActiveWorkspaceId();
      const localProfile = await localDb.getProfileDetails();
      setProfile(stored === 'local' ? localProfile : null);
      setLocalProfileExists(!!localProfile);
      if (stored === 'local' && localProfile) {
        setActiveWorkspace('local');
      } else {
        setActiveWorkspace('online');
      }
      setReady(true);
    })();
  }, [ensureLocalProfile]);

  const db = activeWorkspace === 'local' ? localDb : onlineDb;

  const refreshProfile = useCallback(async () => {
    setProfile(await db.getProfileDetails());
  }, [db]);

  const enterOfflineMode = useCallback(async () => {
    await ensureLocalProfile();
    setActiveWorkspace('local');
    await setActiveWorkspaceId('local');
  }, [ensureLocalProfile]);

  const resetToOnline = useCallback(async () => {
    if (isOfflineBuild) return;
    setActiveWorkspace('online');
    setProfile(null);
    await setActiveWorkspaceId('online');
  }, []);

  const createLocalProfile = useCallback(async () => {
    await ensureLocalProfile();
  }, [ensureLocalProfile]);

  const deleteLocalProfile = useCallback(async () => {
    await localDb.clearLocalData();
    setProfile(null);
    setLocalProfileExists(false);
    if (activeWorkspace === 'local') {
      setActiveWorkspace('online');
      await setActiveWorkspaceId('online');
    }
  }, [activeWorkspace]);

  const value = useMemo(() => ({
    activeWorkspace,
    db,
    profile,
    onlineDb,
    localDb,
    enterOfflineMode,
    resetToOnline,
    createLocalProfile,
    deleteLocalProfile,
    refreshProfile,
    localProfileExists,
  }), [activeWorkspace, db, profile, enterOfflineMode, resetToOnline, createLocalProfile, deleteLocalProfile, refreshProfile, localProfileExists]);

  if (!ready) return null;

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}
