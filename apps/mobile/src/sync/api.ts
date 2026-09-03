import type { MobileAuthResponse } from '@faura-farmer/types';
import { getInstallationId, getStoredSession, type StoredSession } from '@/auth/session';

export type MobileConnectionProblem =
  | 'missing_configuration'
  | 'invalid_configuration'
  | 'production_api'
  | 'server_unavailable'
  | 'mobile_api_disabled';

export class MobileConnectionError extends Error {
  constructor(public readonly problem: MobileConnectionProblem, message: string) {
    super(message);
    this.name = 'MobileConnectionError';
  }
}

export function connectionMessage(error: unknown) {
  if (error instanceof MobileConnectionError) return error.message;
  if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
    return 'Can’t reach the local server. Start the web app on port 3000, then try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function apiBase() {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new MobileConnectionError(
      'missing_configuration',
      'Mobile connection is not configured. Add EXPO_PUBLIC_API_URL to apps/mobile/.env.local, then restart Expo.',
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MobileConnectionError(
      'invalid_configuration',
      'EXPO_PUBLIC_API_URL must be a complete local or Preview URL. Restart Expo after correcting it.',
    );
  }
  if (url.hostname === 'faura-farmer.vercel.app') {
    throw new MobileConnectionError('production_api', 'The production API is not available to the mobile app. Use local development or a Preview URL.');
  }
  return raw.replace(/\/$/, '');
}

async function decode<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({ error: 'Invalid server response' }))) as T & { error?: string };
  if (response.status === 404 && /mobile api is not enabled/i.test(data.error ?? '')) {
    throw new MobileConnectionError(
      'mobile_api_disabled',
      'The mobile API is disabled. Set MOBILE_API_ENABLED=true and a 32+ character MOBILE_AUTH_SECRET in apps/web/.env.local, then restart the web server.',
    );
  }
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export async function mobileRequest<T>(path: string, options: RequestInit = {}, accessToken?: string) {
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
    });
    return decode<T>(response);
  } catch (error) {
    if (error instanceof MobileConnectionError) throw error;
    if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
      throw new MobileConnectionError(
        'server_unavailable',
        'Can’t reach the local server. Start the web app on port 3000, then try again.',
      );
    }
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<MobileAuthResponse> {
  return mobileRequest('/api/mobile/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceId: await getInstallationId() }) });
}

export async function register(email: string, password: string, passwordConfirm: string, name?: string): Promise<MobileAuthResponse> {
  return mobileRequest('/api/mobile/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password, passwordConfirm, name, deviceId: await getInstallationId() }) });
}

export function asStoredSession(session: MobileAuthResponse): StoredSession {
  return { accessToken: session.accessToken, accessTokenExpiresAt: session.accessTokenExpiresAt, refreshToken: session.refreshToken, user: session.user };
}

export async function refreshedSession(existing?: StoredSession | null): Promise<StoredSession> {
  const current = existing ?? await getStoredSession();
  if (!current) throw new Error('Your session has ended');
  const response = await mobileRequest<MobileAuthResponse>('/api/mobile/v1/auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken, deviceId: await getInstallationId() }),
  });
  return asStoredSession(response);
}
