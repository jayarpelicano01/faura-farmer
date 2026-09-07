import { auth } from '@/lib/auth';
import { monthlyBudgetSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { getBucketAllocation, setMonthlyBudget } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';
import { prisma } from '@faura-farmer/database';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';
import { convertMoney } from '@faura-farmer/types';

function allocationPayload(
  allocation: Awaited<ReturnType<typeof getBucketAllocation>>,
  displayCurrency: 'PHP' | 'USD',
) {
  return { ...allocation, displayCurrency };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const display = new URL(request.url).searchParams.get('display') === '1';
  const user = display
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: currencyPreferenceSelect })
    : null;
  const preference = user ? serializeCurrencyPreference(user) : undefined;
  const allocation = await getBucketAllocation(session.user.id, new Date(), preference);
  return ok(allocationPayload(allocation, preference?.displayCurrency ?? 'PHP'));
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'budget-write', session.user.id);
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = monthlyBudgetSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const display = new URL(request.url).searchParams.get('display') === '1';
  const user = display
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: currencyPreferenceSelect })
    : null;
  const preference = user ? serializeCurrencyPreference(user) : undefined;
  const amount = preference
    ? Number(convertMoney(parsed.data.amount, preference.displayCurrency, 'PHP', preference.usdPerPhp))
    : parsed.data.amount;
  const saved = await setMonthlyBudget(session.user.id, amount);
  await recordCanonicalMobileUpsert(session.user.id, 'monthly_budget', saved.id);
  const allocation = await getBucketAllocation(session.user.id, new Date(), preference);
  return ok(allocationPayload(allocation, preference?.displayCurrency ?? 'PHP'));
}
