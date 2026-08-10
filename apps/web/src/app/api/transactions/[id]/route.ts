import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateTransactionSchema } from '@/lib/validations';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const transaction = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
    include: { account: true, category: true },
  });
  if (!transaction) return notFound('Transaction not found');

  return ok(transaction);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const transaction = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
  });
  if (!transaction) return notFound('Transaction not found');

  const body = await request.json().catch(() => null);
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  if (parsed.data.accountId && parsed.data.accountId !== transaction.accountId) {
    const account = await prisma.account.findFirst({
      where: { id: parsed.data.accountId, userId: session.user.id },
      select: { id: true },
    });
    if (!account) return fail('Account not found', 404, 'NOT_FOUND');
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.user.id },
      select: { id: true },
    });
    if (!category) return fail('Category not found', 404, 'NOT_FOUND');
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: parsed.data,
    include: { account: true, category: true },
  });

  return ok(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const transaction = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
  });
  if (!transaction) return notFound('Transaction not found');

  await prisma.transaction.delete({ where: { id: transaction.id } });

  return ok({ id: transaction.id, deleted: true });
}