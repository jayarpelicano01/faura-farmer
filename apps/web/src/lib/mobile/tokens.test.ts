import { afterEach, describe, expect, it } from 'vitest';
import { issueAccessToken, verifyAccessToken } from './tokens';

const priorSecret = process.env.MOBILE_AUTH_SECRET;
afterEach(() => {
  if (priorSecret === undefined) delete process.env.MOBILE_AUTH_SECRET;
  else process.env.MOBILE_AUTH_SECRET = priorSecret;
});

describe('mobile access tokens', () => {
  it('issues a short-lived signed bearer token with session-version claims', () => {
    process.env.MOBILE_AUTH_SECRET = 'test-mobile-secret-with-at-least-32-characters';
    const issued = issueAccessToken({ sub: 'b8b96bfb-7ac8-46f9-a909-6bf47001856d', sid: 'e15ea902-7cf3-4c4b-b63c-88a05e8555ef', sv: 3 });
    expect(new Date(issued.expiresAt).getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(verifyAccessToken(issued.token)).toMatchObject({ aud: 'faura-farmer-mobile', sv: 3 });
  });

  it('rejects malformed and tampered bearer tokens', () => {
    process.env.MOBILE_AUTH_SECRET = 'test-mobile-secret-with-at-least-32-characters';
    const issued = issueAccessToken({ sub: 'b8b96bfb-7ac8-46f9-a909-6bf47001856d', sid: 'e15ea902-7cf3-4c4b-b63c-88a05e8555ef', sv: 0 });
    expect(verifyAccessToken('not-a-token')).toBeNull();
    expect(verifyAccessToken(`${issued.token}x`)).toBeNull();
  });
});
