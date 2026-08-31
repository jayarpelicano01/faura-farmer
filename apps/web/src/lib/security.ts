import { createHash } from 'node:crypto';
import { forbidden, payloadTooLarge, serviceUnavailable, tooManyRequests } from './http';

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }
  | { allowed: false; unavailable: true };

const developmentBuckets = new Map<string, { count: number; resetAt: number }>();

export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 10 * 60 },
  loginEmail: { limit: 8, windowSeconds: 15 * 60 },
  registration: { limit: 5, windowSeconds: 60 * 60 },
  passwordResetIp: { limit: 5, windowSeconds: 60 * 60 },
  passwordResetEmail: { limit: 3, windowSeconds: 60 * 60 },
  passwordChange: { limit: 5, windowSeconds: 15 * 60 },
  oauthLink: { limit: 10, windowSeconds: 15 * 60 },
  mutation: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

const UPSTASH_INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return current
`;

function hashIdentifier(identifier: string) {
  return createHash('sha256').update(identifier).digest('hex');
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

async function incrementUpstash(key: string, windowSeconds: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['EVAL', UPSTASH_INCREMENT_SCRIPT, 1, key, String(windowSeconds)]),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Upstash rate limit request failed with ${response.status}`);
  const body = (await response.json()) as { result?: unknown };
  const count = Number(body.result);
  return Number.isFinite(count) ? count : null;
}

function incrementDevelopmentBucket(key: string, windowSeconds: number) {
  const now = Date.now();
  const existing = developmentBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    developmentBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { count: 1, retryAfter: windowSeconds };
  }

  existing.count += 1;
  return { count: existing.count, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function checkRateLimit(
  scope: string,
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const key = `faura:rate:${scope}:${hashIdentifier(identifier)}`;

  try {
    const count = await incrementUpstash(key, policy.windowSeconds);
    if (count !== null) {
      return count <= policy.limit
        ? { allowed: true }
        : { allowed: false, retryAfter: policy.windowSeconds };
    }
  } catch (error) {
    console.error('Rate limit service failed', { scope, error: error instanceof Error ? error.message : 'unknown' });
    if (isProduction()) return { allowed: false, unavailable: true };
  }

  if (isProduction()) return { allowed: false, unavailable: true };
  const bucket = incrementDevelopmentBucket(key, policy.windowSeconds);
  return bucket.count <= policy.limit
    ? { allowed: true }
    : { allowed: false, retryAfter: bucket.retryAfter };
}

export async function checkRateLimits(
  scope: string,
  identifiers: string[],
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const decisions = await Promise.all(
    identifiers.map((identifier) => checkRateLimit(scope, identifier, policy)),
  );
  if (decisions.some((decision) => !decision.allowed && 'unavailable' in decision)) {
    return { allowed: false, unavailable: true };
  }

  const blocked = decisions.find((decision) => !decision.allowed && 'retryAfter' in decision);
  return blocked && 'retryAfter' in blocked ? blocked : { allowed: true };
}

function allowedOrigins(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return [new URL(configured).origin];
    } catch {
      return [];
    }
  }

  if (!isProduction()) return [new URL(request.url).origin];
  return [];
}

export function requireTrustedOrigin(request: Request) {
  const expectedOrigins = allowedOrigins(request);
  if (expectedOrigins.length === 0) {
    return serviceUnavailable('Trusted application origin is not configured');
  }

  const origin = request.headers.get('origin');
  if (!origin) {
    return isProduction() ? forbidden('A trusted request origin is required') : null;
  }

  try {
    return expectedOrigins.includes(new URL(origin).origin)
      ? null
      : forbidden('Request origin is not allowed');
  } catch {
    return forbidden('Request origin is not allowed');
  }
}

export async function guardMutation(
  request: Request,
  scope: string,
  identifier: string,
  policy: RateLimitPolicy = RATE_LIMITS.mutation,
) {
  const originFailure = requireTrustedOrigin(request);
  if (originFailure) return originFailure;

  const rateLimit = await checkRateLimit(scope, identifier, policy);
  if (rateLimit.allowed) return null;
  if ('unavailable' in rateLimit) {
    return serviceUnavailable('Security services are temporarily unavailable');
  }
  return tooManyRequests('Too many requests. Please try again later.', rateLimit.retryAfter);
}

export async function readJsonBody<T = unknown>(request: Request, maxBytes = 64 * 1024) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { response: payloadTooLarge('Request body is too large') } as const;
  }

  const raw = await request.text().catch(() => '');
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { response: payloadTooLarge('Request body is too large') } as const;
  }

  try {
    return { data: JSON.parse(raw) as T } as const;
  } catch {
    return { data: null as T } as const;
  }
}
