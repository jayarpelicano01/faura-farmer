import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateBudgetSchema } from '@/lib/validations';
import { badRequest, notFound, ok, unauthorized } from '@/lib/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const budget = await prisma.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!budget) return notFound('Budget not found');

  const body = await request.json().catch(() => null);
  const parsed = updateBudgetSchema.safeParse(body);
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

    const existing = await prisma.budget.findFirst({
      where: {
        userId: session.user.id,
        categoryId: parsed.data.categoryId,
        NOT: { id: budget.id },
      },
    });
    if (existing) return badRequest('A budget for this category already exists');
  }

  const updated = await prisma.budget.update({
    where: { id: budget.id },
    data: parsed.data,
  });

  return ok({
    id: updated.id,
    userId: updated.userId,
    categoryId: updated.categoryId,
    monthlyLimit: String(updated.monthlyLimit),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const budget = await prisma.budget.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!budget) return notFound('Budget not found');

  await prisma.budget.delete({ where: { id: budget.id } });

  return ok({ id: budget.id, deleted: true });
}