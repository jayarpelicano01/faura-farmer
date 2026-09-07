import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateBudgetSchema } from '@/lib/validations';
import { badRequest, notFound, ok, unauthorized } from '@/lib/http';
import { findConflictingBudget } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileTombstone, recordCanonicalMobileUpsert } from '@/lib/mobile/sync';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';
import { convertMoney } from '@faura-farmer/types';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'budget-write', session.user.id);
  if (securityFailure) return securityFailure;

  const budget = await prisma.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!budget) return notFound('Budget not found');

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateBudgetSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  if (parsed.data.categoryId && parsed.data.categoryId !== budget.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.user.id },
      select: { id: true, type: true },
    });
    if (!category) return badRequest('Category not found');
    if (category.type !== 'expense') return badRequest('Budgets can only be set on expense categories');

    const conflict = await findConflictingBudget(session.user.id, parsed.data.categoryId, budget.id);
    if (conflict) {
      return badRequest(
        `A budget already exists for a parent or sub-category of "${conflict.categoryName}"`,
      );
    }
  }

  const display = new URL(request.url).searchParams.get('display') === '1';
  const user = display
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: currencyPreferenceSelect })
    : null;
  const preference = user ? serializeCurrencyPreference(user) : null;
  const data = {
    ...parsed.data,
    ...(preference && parsed.data.monthlyLimit !== undefined
      ? {
          monthlyLimit: Number(
            convertMoney(parsed.data.monthlyLimit, preference.displayCurrency, 'PHP', preference.usdPerPhp),
          ),
        }
      : {}),
  };

  const updated = await prisma.budget.update({
    where: { id: budget.id },
    data,
  });
  await recordCanonicalMobileUpsert(session.user.id, 'budget', updated.id);

  return ok({
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    monthlyLimit: String(updated.monthlyLimit),
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'budget-write', session.user.id);
  if (securityFailure) return securityFailure;

  const budget = await prisma.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!budget) return notFound('Budget not found');

  await prisma.budget.delete({ where: { id: budget.id } });
  await recordCanonicalMobileTombstone(session.user.id, 'budget', budget.id);

  return ok({ id: budget.id, deleted: true });
}
