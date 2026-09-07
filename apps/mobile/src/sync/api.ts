import type { MobileAuthResponse } from '@faura-farmer/types';
import { getInstallationId, getStoredSession, type StoredSession } from '@/auth/session';

const REQUEST_TIMEOUT_MS = 10_000;

export type MobileConnectionProblem =
  | 'missing_configuration'
  | 'invalid_configuration'
  | 'server_unavailable'
  | 'mobile_api_disabled';

export class MobileConnectionError extends Error {
  constructor(public readonly problem: MobileConnectionProblem, message: string) {
    super(message);
    this.name = 'MobileConnectionError';
  }
}

export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly requestId: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

export function connectionMessage(error: unknown) {
  if (error instanceof MobileConnectionError) return error.message;
  if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
    return 'Can’t reach the server. Check your connection and try again.';
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
  try {
    new URL(raw);
  } catch {
    throw new MobileConnectionError(
      'invalid_configuration',
      'EXPO_PUBLIC_API_URL must be a complete URL. Restart Expo after correcting it.',
    );
  }
  return raw.replace(/\/$/, '');
}

async function decode<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({ error: 'Invalid server response' }))) as T & { error?: string; code?: string; requestId?: string };
  if (response.status === 404 && /mobile api is not enabled/i.test(data.error ?? '')) {
    throw new MobileConnectionError(
      'mobile_api_disabled',
      'Mobile sync is temporarily unavailable. Please try again later.',
    );
  }
  if (!response.ok) throw new MobileApiError(response.status, data.code, data.requestId, data.error ?? `Request failed (${response.status})`);
  return data;
}

export function isMobileUnauthorized(error: unknown) {
  return error instanceof MobileApiError && error.status === 401;
}

export async function mobileRequest<T>(path: string, options: RequestInit = {}, accessToken?: string) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
      signal: controller.signal,
    });
    return decode<T>(response);
  } catch (error) {
    if (error instanceof MobileConnectionError) throw error;
    if (timedOut) {
      throw new MobileConnectionError('server_unavailable', 'Sync timed out. Check your connection and try again.');
    }
    if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
      throw new MobileConnectionError(
        'server_unavailable',
        'Can’t reach the server. Check your connection and try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
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
