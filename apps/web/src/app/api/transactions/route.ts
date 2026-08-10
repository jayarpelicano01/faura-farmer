import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { createTransactionSchema, transactionListQuerySchema } from '@/lib/validations';
import { badRequest, created, fail, ok, unauthorized } from '@/lib/http';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  const url = new URL(request.url);
  const parsedQuery = transactionListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsedQuery.success) {
    return badRequest(parsedQuery.error.issues[0]?.message ?? 'Invalid query');
  }
  const { accountId, categoryId, type, from, to, q, limit, cursor } = parsedQuery.data;

  const userAccounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return ok({ items: [], nextCursor: null });
  }

  const where: Record<string, unknown> = { accountId: { in: accountIds } };
  if (accountId) where.accountId = accountId;
  if (categoryId) where.categoryId = categoryId;
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = from;
    if (to) (where.date as Record<string, unknown>).lte = to;
  }
  if (q) {
    where.OR = [{ note: { contains: q, mode: 'insensitive' } }];
  }

  const items = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  let nextCursor: string | null = null;
  let pageItems = items;
  if (items.length > limit) {
    const extra = items[limit];
    nextCursor = extra?.id ?? null;
    pageItems = items.slice(0, limit);
  }

  return ok({ items: pageItems, nextCursor });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId },
    select: { id: true },
  });
  if (!account) return fail('Account not found', 404, 'NOT_FOUND');

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, userId },
      select: { id: true },
    });
    if (!category) return fail('Category not found', 404, 'NOT_FOUND');
  }

  const transaction = await prisma.transaction.create({
    data: {
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      amount: parsed.data.amount,
      type: parsed.data.type,
      date: parsed.data.date,
      note: parsed.data.note ?? null,
      source: 'manual',
    },
    include: { account: true, category: true },
  });

  return created(transaction);
}