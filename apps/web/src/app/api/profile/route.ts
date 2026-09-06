import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'profile-write', session.user.id);
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateProfileSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const data: { name?: string | null; username?: string | null; displayCurrency?: 'PHP' | 'USD' } = {};
  if ('name' in parsed.data) data.name = parsed.data.name?.trim() || null;
  if ('username' in parsed.data) {
    const username = parsed.data.username?.trim().toLowerCase();
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== session.user.id) {
        return badRequest('That username is already taken');
      }
      data.username = username;
    } else {
      data.username = null;
    }
  }
  if ('displayCurrency' in parsed.data) data.displayCurrency = parsed.data.displayCurrency;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, email: true, name: true, username: true, authProvider: true, ...currencyPreferenceSelect },
  });

  return ok({ user: { ...user, preference: serializeCurrencyPreference(user) } });
}
