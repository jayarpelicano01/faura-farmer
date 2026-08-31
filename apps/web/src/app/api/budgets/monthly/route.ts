import { auth } from '@/lib/auth';
import { monthlyBudgetSchema } from '@/lib/validations';
import { badRequest, ok, unauthorized } from '@/lib/http';
import { getBucketAllocation, setMonthlyBudget } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const allocation = await getBucketAllocation(session.user.id, new Date());
  return ok(allocation);
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

  await setMonthlyBudget(session.user.id, parsed.data.amount);
  const allocation = await getBucketAllocation(session.user.id, new Date());
  return ok(allocation);
}
