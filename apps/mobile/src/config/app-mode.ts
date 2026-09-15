import Constants from 'expo-constants';

export type AppMode = 'online' | 'offline';

export function resolveAppMode(value: unknown): AppMode {
  return value === 'offline' ? 'offline' : 'online';
}

const configuredMode = Constants.expoConfig?.extra?.faura?.appMode;

/** Build-time mode. Online builds retain both online and local workspaces. */
export const APP_MODE = resolveAppMode(configuredMode);

export const isOfflineBuild = APP_MODE === 'offline';
