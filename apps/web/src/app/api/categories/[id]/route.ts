import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateCategorySchema } from '@/lib/validations';
import { badRequest, notFound, ok, unauthorized } from '@/lib/http';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileTombstone, recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  return ok(category);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'category-write', session.user.id);
  if (securityFailure) return securityFailure;

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  if (
    typeof bodyResult.data === 'object'
    && bodyResult.data !== null
    && 'parentId' in bodyResult.data
    && bodyResult.data.parentId !== null
    && bodyResult.data.parentId !== undefined
  ) {
    return badRequest('Categories cannot have a parent');
  }
  const parsed = updateCategorySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const updated = await prisma.category.update({
    where: { id: category.id },
    data: parsed.data,
  });

  await recordCanonicalMobileUpsert(session.user.id, 'category', updated.id);

  return ok(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'category-write', session.user.id);
  if (securityFailure) return securityFailure;

  const category = await prisma.category.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!category) return notFound('Category not found');

  const [transactions, budgets, recurringRules] = await prisma.$transaction([
    prisma.transaction.findMany({ where: { userId: session.user.id, categoryId: category.id }, select: { id: true } }),
    prisma.budget.findMany({ where: { userId: session.user.id, categoryId: category.id }, select: { id: true } }),
    prisma.recurringRule.findMany({ where: { userId: session.user.id, categoryId: category.id }, select: { id: true } }),
  ]);

  await prisma.category.delete({ where: { id: category.id } });
  for (const transaction of transactions) {
    await recordCanonicalMobileUpsert(session.user.id, 'transaction', transaction.id);
  }
  for (const budget of budgets) {
    await recordCanonicalMobileTombstone(session.user.id, 'budget', budget.id);
  }
  for (const recurringRule of recurringRules) {
    await recordCanonicalMobileUpsert(session.user.id, 'recurring_rule', recurringRule.id);
  }
  await recordCanonicalMobileTombstone(session.user.id, 'category', category.id);

  return ok({ id: category.id, deleted: true });
}
