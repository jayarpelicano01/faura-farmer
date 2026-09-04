import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_DAYS = 30;

type AccessPayload = {
  aud: 'faura-farmer-mobile';
  sub: string;
  sid: string;
  sv: number;
  iat: number;
  exp: number;
};

function secret() {
  const value = process.env.MOBILE_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('A 32-character MOBILE_AUTH_SECRET or AUTH_SECRET is required');
  return value;
}

export function hasMobileAuthSecret() {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

function encode(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return encode(createHmac('sha256', secret()).update(value).digest());
}

export function createOpaqueRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token: string) {
  return createHmac('sha256', secret()).update(`refresh:${token}`).digest('hex');
}

export function issueAccessToken(input: Pick<AccessPayload, 'sub' | 'sid' | 'sv'>) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessPayload = {
    aud: 'faura-farmer-mobile',
    ...input,
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
  };
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encode(JSON.stringify(payload));
  return {
    token: `${header}.${body}.${sign(`${header}.${body}`)}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const [header, body, signature, ...extra] = token.split('.');
  if (!header || !body || !signature || extra.length > 0) return null;
  const expected = sign(`${header}.${body}`);
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !timingSafeEqual(givenBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<AccessPayload>;
    if (
      parsed.aud !== 'faura-farmer-mobile' ||
      typeof parsed.sub !== 'string' ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.sv !== 'number' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed as AccessPayload;
  } catch {
    return null;
  }
}
