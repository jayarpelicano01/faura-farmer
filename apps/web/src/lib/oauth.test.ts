import { describe, expect, it } from 'vitest';
import {
  canUnlinkOAuthIdentity,
  createOAuthLinkIntentCookieValue,
  readOAuthLinkIntentCookieValue,
} from './oauth';

const now = new Date('2026-08-31T12:00:00.000Z');
const secret = 'test-oauth-link-intent-secret';
const payload = {
  intentId: '52b9af87-98d6-4f29-a3a4-0f2f88584f80',
  userId: '7655fd3a-7f0f-4935-8750-dfe64a01abc6',
  provider: 'google' as const,
  expiresAt: Math.floor(now.getTime() / 1000) + 600,
};

describe('OAuth link intent cookies', () => {
  it('accepts a signed, unexpired intent', () => {
    const value = createOAuthLinkIntentCookieValue(payload, secret);

    expect(readOAuthLinkIntentCookieValue(value ?? undefined, now, secret)).toEqual(payload);
  });

  it('rejects a tampered or expired intent', () => {
    const value = createOAuthLinkIntentCookieValue(payload, secret);
    const expired = createOAuthLinkIntentCookieValue({ ...payload, expiresAt: payload.expiresAt - 601 }, secret);

    expect(readOAuthLinkIntentCookieValue(`${value}x`, now, secret)).toBeNull();
    expect(readOAuthLinkIntentCookieValue(expired ?? undefined, now, secret)).toBeNull();
  });
});

describe('OAuth unlink policy', () => {
  it('never permits removal of the last sign-in method', () => {
    expect(canUnlinkOAuthIdentity(false, 1)).toBe(false);
    expect(canUnlinkOAuthIdentity(true, 1)).toBe(true);
    expect(canUnlinkOAuthIdentity(false, 2)).toBe(true);
  });
});
