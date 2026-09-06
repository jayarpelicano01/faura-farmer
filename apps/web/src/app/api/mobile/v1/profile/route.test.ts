import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateMobileRequest: vi.fn(),
  checkRateLimit: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  mobileApiIsEnabled: vi.fn(),
  recordSecurityEvent: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('@faura-farmer/database', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
vi.mock('@/lib/mobile/auth', () => ({ authenticateMobileRequest: mocks.authenticateMobileRequest }));
vi.mock('@/lib/mobile/availability', () => ({
  mobileApiDisabledResponse: () => Response.json({ error: 'Mobile API is not enabled' }, { status: 404 }),
  mobileApiIsEnabled: mocks.mobileApiIsEnabled,
}));
vi.mock('@/lib/http', () => ({
  badRequest: (message: string) => Response.json({ error: message }, { status: 400 }),
  ok: (body: unknown, init?: ResponseInit) => Response.json(body, { ...init, status: init?.status ?? 200 }),
  serviceUnavailable: (message: string) => Response.json({ error: message }, { status: 503 }),
  tooManyRequests: (message: string, retryAfter?: number) => Response.json(
    { error: message },
    { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined },
  ),
  unauthorized: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));
vi.mock('@/lib/security-events', () => ({ recordSecurityEvent: mocks.recordSecurityEvent }));
vi.mock('@/lib/validations', () => ({
  changePasswordSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  updateProfileSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
}));
vi.mock('@/lib/security', () => ({
  RATE_LIMITS: { mutation: {}, passwordChange: {} },
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => '127.0.0.1',
  readJsonBody: async (request: Request) => ({ data: await request.json() }),
}));

import { GET, PATCH } from './route';
import { POST as changePassword } from './password/route';

const userId = '7655fd3a-7f0f-4935-8750-dfe64a01abc6';
const mobileUser = { id: userId, email: 'farmer@example.com', name: 'Faura Farmer', sessionVersion: 1 };
const profile = { id: userId, email: 'farmer@example.com', name: 'Faura Farmer', username: 'faura', passwordHash: 'hash' };

function request(path: string, method = 'GET', body?: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('mobile profile routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mobileApiIsEnabled.mockReturnValue(true);
    mocks.authenticateMobileRequest.mockResolvedValue(mobileUser);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it('rejects an unauthenticated profile read', async () => {
    mocks.authenticateMobileRequest.mockResolvedValue(null);

    const response = (await GET(request('/api/mobile/v1/profile')))!;

    expect(response.status).toBe(401);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('returns the authenticated user profile without caching it', async () => {
    mocks.userFindUnique.mockResolvedValue(profile);

    const response = (await GET(request('/api/mobile/v1/profile')))!;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      user: { id: userId, email: 'farmer@example.com', name: 'Faura Farmer', username: 'faura', hasPassword: true },
    });
  });

  it('normalizes a unique username before saving the profile', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userUpdate.mockResolvedValue({ ...profile, name: 'New name', username: 'new.name' });

    const response = (await PATCH(request('/api/mobile/v1/profile', 'PATCH', { name: 'New name', username: 'New.Name' })))!;

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: { name: 'New name', username: 'new.name' },
    }));
  });

  it('does not change a password when the current password is wrong', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: userId, passwordHash: 'hash' });
    mocks.compare.mockResolvedValue(false);

    const response = (await changePassword(request('/api/mobile/v1/profile/password', 'POST', {
      currentPassword: 'wrong-password',
      newPassword: 'Strong!1Password',
      confirmPassword: 'Strong!1Password',
    })))!;

    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('changes a verified password and invalidates existing mobile sessions', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: userId, passwordHash: 'hash' });
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue('new-hash');
    mocks.userUpdate.mockResolvedValue({});

    const response = (await changePassword(request('/api/mobile/v1/profile/password', 'POST', {
      currentPassword: 'Old!1Password',
      newPassword: 'Strong!1Password',
      confirmPassword: 'Strong!1Password',
    })))!;

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: 'new-hash', sessionVersion: { increment: 1 } },
    });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith('password_changed', expect.objectContaining({ userId }));
  });
});
