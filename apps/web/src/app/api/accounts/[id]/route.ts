import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateAccountSchema } from '@/lib/validations';
import { badRequest, notFound, ok, unauthorized } from '@/lib/http';
import { toNumber } from '@/lib/format';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  let net = 0;
  const grouped = await prisma.transaction.groupBy({
    by: ['type'],
    where: { accountId: account.id },
    _sum: { amount: true },
  });
  for (const row of grouped) {
    if (row.type === 'income') net += toNumber(row._sum.amount);
    else net -= toNumber(row._sum.amount);
  }

  return ok({
    ...account,
    startingBalance: String(account.startingBalance),
    balance: String(toNumber(account.startingBalance) + net),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  const body = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: parsed.data,
  });

  return ok({ ...updated, startingBalance: String(updated.startingBalance) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  await prisma.transaction.deleteMany({ where: { accountId: account.id } });
  await prisma.recurringRule.deleteMany({ where: { accountId: account.id } });
  await prisma.account.delete({ where: { id: account.id } });

  return ok({ id: account.id, deleted: true });
}