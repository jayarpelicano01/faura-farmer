import { describe, expect, it } from 'vitest';
import { RATE_LIMITS, checkRateLimit, readJsonBody, requireTrustedOrigin } from './security';

describe('request security helpers', () => {
  it('rejects cross-origin mutations', () => {
    const request = new Request('https://app.example.com/api/accounts', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
    });
    const response = requireTrustedOrigin(request);

    expect(response?.status).toBe(403);
  });

  it('accepts the configured application origin', () => {
    const request = new Request('https://app.example.com/api/accounts', {
      method: 'POST',
      headers: { Origin: 'https://app.example.com' },
    });
    const response = requireTrustedOrigin(request);

    expect(response).toBeNull();
  });

  it('enforces a local rate limit when Redis is not configured', async () => {
    const policy = { limit: 1, windowSeconds: 60 };
    const identifier = `test-${crypto.randomUUID()}`;

    await expect(checkRateLimit('test', identifier, policy)).resolves.toEqual({ allowed: true });
    await expect(checkRateLimit('test', identifier, policy)).resolves.toMatchObject({ allowed: false });
  });

  it('rejects oversized JSON bodies before parsing', async () => {
    const request = new Request('https://app.example.com/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ payload: 'x'.repeat(128) }),
    });
    const result = await readJsonBody(request, 64);

    expect('response' in result).toBe(true);
    if ('response' in result) expect(result.response?.status).toBe(413);
  });

  it('uses explicit rate-limit policy values', () => {
    expect(RATE_LIMITS.passwordChange.limit).toBe(5);
    expect(RATE_LIMITS.registration.windowSeconds).toBe(60 * 60);
  });
});
