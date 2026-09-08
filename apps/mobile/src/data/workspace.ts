import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export type WorkspaceId = 'online' | 'local';

export type WorkspaceDescriptor = {
  id: WorkspaceId;
  label: string;
  databaseName: string;
  requiresAuth: boolean;
};

export const ONLINE_WORKSPACE: WorkspaceDescriptor = {
  id: 'online',
  label: 'Online',
  databaseName: 'faura-farmer.db',
  requiresAuth: false,
};

export const LOCAL_WORKSPACE: WorkspaceDescriptor = {
  id: 'local',
  label: 'Local only',
  databaseName: 'faura-farmer-local.db',
  requiresAuth: true,
};

export const WORKSPACE_KEY = 'mobile-active-workspace-v1';
export const LOCAL_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

export async function getActiveWorkspaceId(): Promise<WorkspaceId> {
  const stored = await SecureStore.getItemAsync(WORKSPACE_KEY);
  if (stored === 'local' || stored === 'online') return stored;
  return 'online';
}

export async function setActiveWorkspaceId(id: WorkspaceId) {
  await SecureStore.setItemAsync(WORKSPACE_KEY, id);
}

export async function authenticateForLocalWorkspace(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock local workspace',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });
  return result.success;
}
