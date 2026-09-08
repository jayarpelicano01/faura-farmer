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
  authenticateForLocalWorkspace,
} from '@/data/workspace';
import { useSession } from '@/auth/session';

type WorkspaceContextValue = {
  activeWorkspace: WorkspaceId;
  db: DatabaseHandle;
  onlineDb: DatabaseHandle;
  localDb: DatabaseHandle;
  switchWorkspace: (id: WorkspaceId) => Promise<void>;
  createLocalProfile: () => Promise<void>;
  deleteLocalProfile: () => Promise<void>;
  localProfileExists: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const onlineDb = createDatabase(ONLINE_WORKSPACE.databaseName);
const localDb = createDatabase(LOCAL_WORKSPACE.databaseName);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session, status } = useSession();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('online');
  const [localProfileExists, setLocalProfileExists] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await onlineDb.initializeDatabase();
      await localDb.initializeDatabase();
      const stored = await getActiveWorkspaceId();
      const localProfile = await localDb.getProfileDetails();
      setLocalProfileExists(!!localProfile);
      if (stored === 'local' && localProfile) {
        setActiveWorkspace('local');
      } else {
        setActiveWorkspace('online');
      }
      setReady(true);
    })();
  }, []);

  const db = activeWorkspace === 'local' ? localDb : onlineDb;

  const switchWorkspace = useCallback(async (id: WorkspaceId) => {
    if (id === 'local') {
      const localProfile = await localDb.getProfileDetails();
      if (!localProfile) return;
      const authed = await authenticateForLocalWorkspace();
      if (!authed) return;
    }
    setActiveWorkspace(id);
    await setActiveWorkspaceId(id);
  }, []);

  const createLocalProfile = useCallback(async () => {
    const existing = await localDb.getProfileDetails();
    if (existing) return;
    await localDb.saveProfileDetails({
      id: LOCAL_PROFILE_ID,
      email: '',
      name: 'Local',
      username: null,
      hasPassword: false,
      displayCurrency: 'PHP',
      usdPerPhp: null,
      rateDate: null,
      rateRefreshedAt: null,
    });
    setLocalProfileExists(true);
  }, []);

  const deleteLocalProfile = useCallback(async () => {
    await localDb.clearLocalData();
    setLocalProfileExists(false);
    if (activeWorkspace === 'local') {
      setActiveWorkspace('online');
      await setActiveWorkspaceId('online');
    }
  }, [activeWorkspace]);

  const value = useMemo(() => ({
    activeWorkspace,
    db,
    onlineDb,
    localDb,
    switchWorkspace,
    createLocalProfile,
    deleteLocalProfile,
    localProfileExists,
  }), [activeWorkspace, db, switchWorkspace, createLocalProfile, deleteLocalProfile, localProfileExists]);

  if (!ready) return null;

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}
