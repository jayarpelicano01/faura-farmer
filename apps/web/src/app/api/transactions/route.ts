import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { badRequest, created, fail, ok, unauthorized } from '@/lib/http';
import { lockAccountsInOrder, toLogicalTransactions } from '@/lib/queries';
import { createTransactionSchema, transactionListQuerySchema } from '@/lib/validations';

const transactionInclude = { account: true, category: true } as const;

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
  const { accountId, categoryId, type, from, to, q, page, perPage } = parsedQuery.data;

  if (accountId) {
    const ownedAccount = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!ownedAccount) return fail('Account not found', 404, 'NOT_FOUND');
  }

  const where: Prisma.TransactionWhereInput = { account: { userId } };
  if (categoryId) where.categoryId = categoryId;
  if (type) where.type = type;
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (q) where.note = { contains: q, mode: 'insensitive' };

  const rows = await prisma.transaction.findMany({
    where,
    include: transactionInclude,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });
  const logical = toLogicalTransactions(rows).filter(
    (transaction) =>
      !accountId ||
      transaction.accountId === accountId ||
      transaction.destinationAccountId === accountId,
  );
  const total = logical.length;
  const items = logical.slice((page - 1) * perPage, page * perPage);

  return ok({ items, total, page, perPage });
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
  const input = parsed.data;

  if (input.type === 'transfer') {
    const transferResult = await prisma.$transaction(async (tx) => {
      const accounts = await lockAccountsInOrder(tx, [
        input.accountId,
        input.destinationAccountId,
      ], userId);
      const sourceAccount = accounts.find((account) => account.id === input.accountId);
      const destinationAccount = accounts.find(
        (account) => account.id === input.destinationAccountId,
      );
      if (
        !sourceAccount ||
        !destinationAccount ||
        sourceAccount.userId !== userId ||
        destinationAccount.userId !== userId
      ) {
        return { status: 'not_found' as const };
      }
      if (sourceAccount.currency.toUpperCase() !== destinationAccount.currency.toUpperCase()) {
        return { status: 'currency_mismatch' as const };
      }

      const transferGroupId = randomUUID();
      const outgoing = await tx.transaction.create({
        data: {
          accountId: input.accountId,
          categoryId: null,
          bucket: null,
          amount: input.amount,
          type: 'transfer',
          transferGroupId,
          transferRole: 'outgoing',
          date: input.date,
          note: input.note ?? null,
          source: 'manual',
        },
        include: transactionInclude,
      });
      const incoming = await tx.transaction.create({
        data: {
          accountId: input.destinationAccountId,
          categoryId: null,
          bucket: null,
          amount: input.amount,
          type: 'transfer',
          transferGroupId,
          transferRole: 'incoming',
          date: input.date,
          note: input.note ?? null,
          source: 'manual',
        },
        include: transactionInclude,
      });

      return { status: 'created' as const, outgoing, incoming };
    });

    if (transferResult.status === 'not_found') {
      return fail('Account not found', 404, 'NOT_FOUND');
    }
    if (transferResult.status === 'currency_mismatch') {
      return fail(
        'Transfers require accounts with the same currency',
        400,
        'CURRENCY_MISMATCH',
      );
    }

    return created(
      toLogicalTransactions([transferResult.outgoing, transferResult.incoming])[0],
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId },
    select: { id: true },
  });
  if (!account) return fail('Account not found', 404, 'NOT_FOUND');

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!category) return fail('Category not found', 404, 'NOT_FOUND');
  }

  const transaction = await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      bucket: input.bucket ?? null,
      amount: input.amount,
      type: input.type,
      date: input.date,
      note: input.note ?? null,
      source: 'manual',
    },
    include: transactionInclude,
  });

  return created(toLogicalTransactions([transaction])[0]);
}
