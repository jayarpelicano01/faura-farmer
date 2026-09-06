import { Prisma, prisma } from '@faura-farmer/database';
import type { MobileProfile } from '@faura-farmer/types';
import { badRequest, ok, serviceUnavailable, tooManyRequests, unauthorized } from '@/lib/http';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { mobileApiDisabledResponse, mobileApiIsEnabled } from '@/lib/mobile/availability';
import { checkRateLimit, getClientIp, RATE_LIMITS, readJsonBody } from '@/lib/security';
import { updateProfileSchema } from '@/lib/validations';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';

const profileSelect = {
  id: true,
  email: true,
  name: true,
  username: true,
  passwordHash: true,
  ...currencyPreferenceSelect,
} as const;

function serializeProfile(user: {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  passwordHash: string | null;
  displayCurrency: string;
  usdPerPhp: Prisma.Decimal | null;
  rateDate: Date | null;
  rateRefreshedAt: Date | null;
}): MobileProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    hasPassword: Boolean(user.passwordHash),
    ...serializeCurrencyPreference(user),
  };
}

function noStore<T>(data: T) {
  return ok(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

async function mobileUser(request: Request) {
  if (!mobileApiIsEnabled()) return { response: mobileApiDisabledResponse() } as const;
  const user = await authenticateMobileRequest(request);
  if (!user) return { response: unauthorized() } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const mobile = await mobileUser(request);
  if ('response' in mobile) return mobile.response;

  const user = await prisma.user.findUnique({ where: { id: mobile.user.id }, select: profileSelect });
  if (!user) return unauthorized();
  return noStore({ user: serializeProfile(user) });
}

export async function PATCH(request: Request) {
  const mobile = await mobileUser(request);
  if ('response' in mobile) return mobile.response;

  const limited = await checkRateLimit('mobile-profile-write', `${mobile.user.id}:${getClientIp(request)}`, RATE_LIMITS.mutation);
  if (!limited.allowed) {
    if ('unavailable' in limited) return serviceUnavailable('Profile updates are temporarily unavailable');
    return tooManyRequests('Too many profile updates. Please try again later.', limited.retryAfter);
  }

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateProfileSchema.safeParse(bodyResult.data);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');

  const data: { name?: string | null; username?: string | null; displayCurrency?: 'PHP' | 'USD' } = {};
  if ('name' in parsed.data) data.name = parsed.data.name?.trim() || null;
  if ('username' in parsed.data) {
    const username = parsed.data.username?.trim().toLowerCase();
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== mobile.user.id) return badRequest('That username is already taken');
      data.username = username;
    } else {
      data.username = null;
    }
  }
  if ('displayCurrency' in parsed.data) data.displayCurrency = parsed.data.displayCurrency;

  const user = await prisma.user.update({ where: { id: mobile.user.id }, data, select: profileSelect });
  return noStore({ user: serializeProfile(user) });
}
