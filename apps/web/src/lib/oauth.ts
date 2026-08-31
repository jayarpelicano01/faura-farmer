import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthProvider } from '@faura-farmer/types';

export const OAUTH_PROVIDERS = ['google', 'facebook'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_LINK_INTENT_MAX_AGE_SECONDS = 10 * 60;

type OAuthLinkIntentCookiePayload = {
  intentId: string;
  userId: string;
  provider: OAuthProvider;
  expiresAt: number;
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return OAUTH_PROVIDERS.includes(value as OAuthProvider);
}

export function isOAuthProviderEnabled(provider: OAuthProvider) {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  return Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
}

export function oauthLinkIntentCookieName() {
  return process.env.NODE_ENV === 'production'
    ? '__Host-faura.oauth-link-intent'
    : 'faura.oauth-link-intent';
}

export const oauthLinkIntentCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: OAUTH_LINK_INTENT_MAX_AGE_SECONDS,
};

function signingSecret() {
  return process.env.AUTH_SECRET?.trim() || null;
}

export function isOAuthLinkIntentSigningConfigured() {
  return signingSecret() !== null;
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createOAuthLinkIntentCookieValue(
  payload: OAuthLinkIntentCookiePayload,
  secret = signingSecret(),
) {
  if (!secret) return null;
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readOAuthLinkIntentCookieValue(
  value: string | undefined,
  now = new Date(),
  secret = signingSecret(),
): OAuthLinkIntentCookiePayload | null {
  if (!value || !secret) return null;
  const [encodedPayload, signature, ...extra] = value.split('.');
  if (!encodedPayload || !signature || extra.length > 0) return null;
  if (!signaturesMatch(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<OAuthLinkIntentCookiePayload>;
    const intentId = payload.intentId;
    const userId = payload.userId;
    const provider = payload.provider;
    const expiresAt = payload.expiresAt;
    if (
      typeof intentId !== 'string' ||
      typeof userId !== 'string' ||
      (provider !== 'google' && provider !== 'facebook') ||
      typeof expiresAt !== 'number' ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= Math.floor(now.getTime() / 1000)
    ) {
      return null;
    }
    return {
      intentId,
      userId,
      provider,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function isCurrentAuthProvider(value: unknown): value is AuthProvider {
  return value === 'email' || isOAuthProvider(String(value));
}

export function canUnlinkOAuthIdentity(hasPassword: boolean, oauthIdentityCount: number) {
  return hasPassword || oauthIdentityCount > 1;
}

export function clearOAuthLinkIntentCookieHeader() {
  const attributes = [
    `${oauthLinkIntentCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (oauthLinkIntentCookieOptions.secure) attributes.push('Secure');
  return attributes.join('; ');
}
