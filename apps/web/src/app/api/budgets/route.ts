import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { createBudgetSchema } from '@/lib/validations';
import { badRequest, created, ok, unauthorized } from '@/lib/http';
import { findConflictingBudget, getBudgetsWithProgress } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileUpsert } from '@/lib/mobile/sync';
import { loadDisplayPreference } from '@/lib/currency-preference';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const { preference } = await loadDisplayPreference(request.url, session.user.id);
  const budgets = await getBudgetsWithProgress(session.user.id, new Date(), preference);
  return ok(budgets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'budget-write', session.user.id);
  if (securityFailure) return securityFailure;

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = createBudgetSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId: session.user.id },
    select: { id: true, type: true },
  });
  if (!category) return badRequest('Category not found');
  if (category.type !== 'expense') return badRequest('Budgets can only be set on expense categories');

  const conflict = await findConflictingBudget(session.user.id, parsed.data.categoryId);
  if (conflict) {
    return badRequest('A budget already exists for this category');
  }

  const { toStorage } = await loadDisplayPreference(request.url, session.user.id);
  const monthlyLimit = toStorage(parsed.data.monthlyLimit);

  const budget = await prisma.budget.create({
    data: {
      userId: session.user.id,
      categoryId: parsed.data.categoryId,
      monthlyLimit,
    },
  });
  await recordCanonicalMobileUpsert(session.user.id, 'budget', budget.id);

  return created({
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    monthlyLimit: String(budget.monthlyLimit),
  });
}
