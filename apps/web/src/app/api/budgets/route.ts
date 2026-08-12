import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { createBudgetSchema } from '@/lib/validations';
import { badRequest, created, ok, unauthorized } from '@/lib/http';
import { findConflictingBudget, getBudgetsWithProgress } from '@/lib/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const budgets = await getBudgetsWithProgress(session.user.id, new Date());
  return ok(budgets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createBudgetSchema.safeParse(body);
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
    return badRequest(
      `A budget already exists for a parent or sub-category of "${conflict.categoryName}"`,
    );
  }

  const budget = await prisma.budget.create({
    data: {
      userId: session.user.id,
      categoryId: parsed.data.categoryId,
      monthlyLimit: parsed.data.monthlyLimit,
    },
  });

  return created({
    id: budget.id,
    userId: budget.userId,
    categoryId: budget.categoryId,
    monthlyLimit: String(budget.monthlyLimit),
  });
}