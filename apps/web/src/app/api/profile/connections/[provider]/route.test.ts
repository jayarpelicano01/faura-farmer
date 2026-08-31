import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardMutation: vi.fn(),
  recordSecurityEvent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@faura-farmer/database', () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } },
  prisma: { $transaction: mocks.transaction },
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));

vi.mock('@/lib/http', () => {
  const json = (body: unknown, status: number) => Response.json(body, { status });
  return {
    badRequest: (message: string) => json({ error: message }, 400),
    fail: (message: string, status: number, code?: string) =>
      json({ error: message, ...(code ? { code } : {}) }, status),
    notFound: (message: string) => json({ error: message }, 404),
    ok: (body: unknown) => {
      const response = Response.json(body) as Response & {
        cookies: { set: (value: { name: string; value: string }) => void };
      };
      response.cookies = {
        set: ({ name, value }) => response.headers.set('Set-Cookie', `${name}=${value}; HttpOnly`),
      };
      return response;
    },
    serviceUnavailable: (message: string) => json({ error: message }, 503),
    unauthorized: () => json({ error: 'Unauthorized' }, 401),
  };
});

vi.mock('@/lib/oauth', () => ({
  OAUTH_LINK_INTENT_MAX_AGE_SECONDS: 600,
  canUnlinkOAuthIdentity: (hasPassword: boolean, identityCount: number) =>
    hasPassword || identityCount > 1,
  createOAuthLinkIntentCookieValue: () => 'signed-link-intent',
  isOAuthLinkIntentSigningConfigured: () => true,
  isOAuthProvider: (provider: string) => provider === 'google' || provider === 'facebook',
  isOAuthProviderEnabled: () => true,
  oauthLinkIntentCookieName: () => 'faura.oauth-link-intent',
  oauthLinkIntentCookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    maxAge: 600,
  },
}));

vi.mock('@/lib/security', () => ({
  guardMutation: mocks.guardMutation,
  RATE_LIMITS: {
    oauthLink: { limit: 10, windowSeconds: 15 * 60 },
  },
}));

vi.mock('@/lib/security-events', () => ({ recordSecurityEvent: mocks.recordSecurityEvent }));

import { DELETE, POST } from './route';

const userId = '7655fd3a-7f0f-4935-8750-dfe64a01abc6';
const request = () =>
  new Request('http://localhost:3000/api/profile/connections/google', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000' },
  });
const routeParams = { params: Promise.resolve({ provider: 'google' }) };

describe('profile connection routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: userId, authProvider: 'email' } });
    mocks.guardMutation.mockResolvedValue(null);
    process.env.AUTH_SECRET = 'test-oauth-link-intent-secret';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  });

  it('creates a signed, short-lived intent before starting a provider connection', async () => {
    const tx = {
      oAuthLinkIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: '52b9af87-98d6-4f29-a3a4-0f2f88584f80' }),
      },
    };
    mocks.transaction.mockImplementation((operation: (client: typeof tx) => unknown) => operation(tx));

    const response = await POST(request(), routeParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ provider: 'google' });
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(tx.oAuthLinkIntent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId, provider: 'google' }) }),
    );
  });

  it('rejects removal of the final OAuth identity when no password exists', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: null }),
        update: vi.fn(),
      },
      oAuthIdentity: {
        findFirst: vi.fn().mockResolvedValue({ id: 'identity-id' }),
        count: vi.fn().mockResolvedValue(1),
        delete: vi.fn(),
      },
    };
    mocks.transaction.mockImplementation((operation: (client: typeof tx) => unknown) => operation(tx));

    const response = await DELETE(request(), routeParams);

    expect(response.status).toBe(400);
    expect(tx.oAuthIdentity.delete).not.toHaveBeenCalled();
  });

  it('removes an identity when a password remains available', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash: 'hash' }),
        update: vi.fn().mockResolvedValue({}),
      },
      oAuthIdentity: {
        findFirst: vi.fn().mockResolvedValue({ id: 'identity-id' }),
        count: vi.fn().mockResolvedValue(1),
        delete: vi.fn().mockResolvedValue({ id: 'identity-id' }),
      },
    };
    mocks.transaction.mockImplementation((operation: (client: typeof tx) => unknown) => operation(tx));

    const response = await DELETE(request(), routeParams);

    expect(response.status).toBe(200);
    expect(tx.oAuthIdentity.delete).toHaveBeenCalledWith({ where: { id: 'identity-id' } });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith(
      'oauth_identity_unlinked',
      expect.objectContaining({ userId }),
    );
  });
});
