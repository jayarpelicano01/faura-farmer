import { randomUUID } from 'node:crypto';
import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';
import {
  lockAccountsInOrder,
  toLogicalTransactions,
  type TransactionWithRelations,
} from '@/lib/queries';
import { createTransactionSchema, updateTransactionSchema } from '@/lib/validations';

const transactionInclude = { account: true, category: true } as const;

async function findOwnedTransaction(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, account: { userId } },
    include: transactionInclude,
  });
}

async function findTransferGroup(transaction: TransactionWithRelations, userId: string) {
  if (!transaction.transferGroupId) return [transaction];
  return prisma.transaction.findMany({
    where: {
      transferGroupId: transaction.transferGroupId,
      account: { userId },
    },
    include: transactionInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const transaction = await findOwnedTransaction(id, session.user.id);
  if (!transaction) return notFound('Transaction not found');

  const group = await findTransferGroup(transaction, session.user.id);
  return ok(toLogicalTransactions(group)[0]);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const userId = session.user.id;

  const transaction = await findOwnedTransaction(id, userId);
  if (!transaction) return notFound('Transaction not found');

  const body = await request.json().catch(() => null);
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const input = parsed.data;

  const group = await findTransferGroup(transaction, userId);
  const outgoing = group.find((row) => row.transferRole === 'outgoing');
  const incoming = group.find((row) => row.transferRole === 'incoming');
  const source = outgoing ?? transaction;
  const targetType = input.type ?? source.type;

  if (targetType === 'transfer' && (input.categoryId !== undefined || input.bucket !== undefined)) {
    return badRequest('Transfers cannot have a category or budget bucket');
  }
  if (targetType !== 'transfer' && input.destinationAccountId !== undefined) {
    return badRequest('Destination account is only valid for transfers');
  }

  const common = {
    accountId: input.accountId ?? source.accountId,
    amount: input.amount ?? Number(source.amount),
    type: targetType,
    date: input.date ?? source.date,
    note: input.note !== undefined ? input.note : source.note,
  };
  const finalInput =
    targetType === 'transfer'
      ? {
          ...common,
          type: 'transfer' as const,
          destinationAccountId: input.destinationAccountId ?? incoming?.accountId,
        }
      : {
          ...common,
          type: targetType,
          categoryId:
            input.categoryId !== undefined ? input.categoryId : source.categoryId,
          bucket: input.bucket !== undefined ? input.bucket : source.bucket,
        };
  const finalParsed = createTransactionSchema.safeParse(finalInput);
  if (!finalParsed.success) {
    return badRequest(finalParsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const final = finalParsed.data;

  if (final.type === 'transfer') {
    let accountIdsToLock = [
        source.accountId,
        ...(incoming ? [incoming.accountId] : []),
        final.accountId,
        final.destinationAccountId,
      ];
    let transferUpdated = false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const transferResult = await prisma.$transaction(async (tx) => {
        const accounts = await lockAccountsInOrder(tx, accountIdsToLock, userId);
        const currentSource = await tx.transaction.findFirst({
          where: { id: source.id, account: { userId } },
          select: {
            id: true,
            accountId: true,
            transferGroupId: true,
            source: true,
            account: { select: { userId: true } },
          },
        });
        if (!currentSource) return { status: 'not_found' as const };

        const currentGroup = currentSource.transferGroupId
          ? await tx.transaction.findMany({
              where: { transferGroupId: currentSource.transferGroupId },
              select: {
                id: true,
                accountId: true,
                transferRole: true,
                account: { select: { userId: true } },
              },
            })
          : [];
        if (currentGroup.some((row) => row.account.userId !== userId)) {
          return { status: 'ownership_conflict' as const };
        }

        const requiredAccountIds = [
          ...new Set([
            currentSource.accountId,
            ...currentGroup.map((row) => row.accountId),
            final.accountId,
            final.destinationAccountId,
          ]),
        ].sort();
        const lockedIds = new Set(accounts.map((account) => account.id));
        if (requiredAccountIds.some((requiredId) => !lockedIds.has(requiredId))) {
          return { status: 'retry' as const, accountIds: requiredAccountIds };
        }

        const sourceAccount = accounts.find((account) => account.id === final.accountId);
        const destinationAccount = accounts.find(
          (account) => account.id === final.destinationAccountId,
        );
        if (!sourceAccount || !destinationAccount) {
          return { status: 'not_found' as const };
        }
        if (sourceAccount.currency.toUpperCase() !== destinationAccount.currency.toUpperCase()) {
          return { status: 'currency_mismatch' as const };
        }

        const transferGroupId = currentSource.transferGroupId ?? randomUUID();
        const currentIncoming = currentGroup.find((row) => row.transferRole === 'incoming');
        await tx.transaction.update({
          where: { id: currentSource.id },
          data: {
            accountId: final.accountId,
            categoryId: null,
            bucket: null,
            amount: final.amount,
            type: 'transfer',
            transferGroupId,
            transferRole: 'outgoing',
            date: final.date,
            note: final.note ?? null,
          },
        });

        if (currentIncoming && currentIncoming.id !== currentSource.id) {
          await tx.transaction.update({
            where: { id: currentIncoming.id },
            data: {
              accountId: final.destinationAccountId,
              categoryId: null,
              bucket: null,
              amount: final.amount,
              type: 'transfer',
              transferGroupId,
              transferRole: 'incoming',
              date: final.date,
              note: final.note ?? null,
            },
          });
        } else {
          await tx.transaction.create({
            data: {
              accountId: final.destinationAccountId,
              categoryId: null,
              bucket: null,
              amount: final.amount,
              type: 'transfer',
              transferGroupId,
              transferRole: 'incoming',
              date: final.date,
              note: final.note ?? null,
              source: currentSource.source,
            },
          });
        }

        return { status: 'updated' as const };
      });

      if (transferResult.status === 'retry') {
        accountIdsToLock = transferResult.accountIds;
        continue;
      }
      if (transferResult.status === 'not_found') {
        return fail('Account not found', 404, 'NOT_FOUND');
      }
      if (transferResult.status === 'ownership_conflict') {
        return fail(
          'Transfer cannot be updated because its accounts have invalid ownership',
          409,
          'TRANSACTION_UPDATE_CONFLICT',
        );
      }
      if (transferResult.status === 'currency_mismatch') {
        return fail(
          'Transfers require accounts with the same currency',
          400,
          'CURRENCY_MISMATCH',
        );
      }

      transferUpdated = true;
      break;
    }

    if (!transferUpdated) {
      return fail(
        'Transfer relationships changed during the update; try again',
        409,
        'TRANSACTION_UPDATE_CONFLICT',
      );
    }
  } else {
    const account = await prisma.account.findFirst({
      where: { id: final.accountId, userId },
      select: { id: true },
    });
    if (!account) return fail('Account not found', 404, 'NOT_FOUND');

    if (final.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: final.categoryId, userId },
        select: { id: true },
      });
      if (!category) return fail('Category not found', 404, 'NOT_FOUND');
    }

    let accountIdsToLock = [
      source.accountId,
      ...group.map((row) => row.accountId),
      final.accountId,
    ];
    let ordinaryUpdated = false;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const ordinaryResult = await prisma.$transaction(async (tx) => {
        const lockedAccounts = await lockAccountsInOrder(tx, accountIdsToLock, userId);
        const currentSource = await tx.transaction.findFirst({
          where: { id: source.id, account: { userId } },
          select: {
            id: true,
            accountId: true,
            transferGroupId: true,
          },
        });
        if (!currentSource) return { status: 'transaction_not_found' as const };

        if (!lockedAccounts.some((account) => account.id === final.accountId)) {
          return { status: 'account_not_found' as const };
        }

        const currentGroup = currentSource.transferGroupId
          ? await tx.transaction.findMany({
              where: { transferGroupId: currentSource.transferGroupId },
              select: {
                accountId: true,
                account: { select: { userId: true } },
              },
            })
          : [];
        if (currentGroup.some((row) => row.account.userId !== userId)) {
          return { status: 'ownership_conflict' as const };
        }

        const requiredAccountIds = [
          ...new Set([
            currentSource.accountId,
            ...currentGroup.map((row) => row.accountId),
            final.accountId,
          ]),
        ].sort();
        const lockedIds = new Set(lockedAccounts.map((account) => account.id));
        if (requiredAccountIds.some((accountId) => !lockedIds.has(accountId))) {
          return { status: 'retry' as const, accountIds: requiredAccountIds };
        }

        await tx.transaction.update({
          where: { id: currentSource.id },
          data: {
            accountId: final.accountId,
            categoryId: final.categoryId ?? null,
            bucket: final.bucket ?? null,
            amount: final.amount,
            type: final.type,
            transferGroupId: null,
            transferRole: null,
            date: final.date,
            note: final.note ?? null,
          },
        });

        if (currentSource.transferGroupId) {
          await tx.transaction.deleteMany({
            where: {
              transferGroupId: currentSource.transferGroupId,
              account: { userId },
            },
          });
        }

        return { status: 'updated' as const };
      });

      if (ordinaryResult.status === 'retry') {
        accountIdsToLock = ordinaryResult.accountIds;
        continue;
      }
      if (ordinaryResult.status === 'transaction_not_found') {
        return notFound('Transaction not found');
      }
      if (ordinaryResult.status === 'account_not_found') {
        return fail('Account not found', 404, 'NOT_FOUND');
      }
      if (ordinaryResult.status === 'ownership_conflict') {
        return fail(
          'Transaction cannot be updated because its transfer has invalid ownership',
          409,
          'TRANSACTION_UPDATE_CONFLICT',
        );
      }

      ordinaryUpdated = true;
      break;
    }

    if (!ordinaryUpdated) {
      return fail(
        'Transfer relationships changed during the update; try again',
        409,
        'TRANSACTION_UPDATE_CONFLICT',
      );
    }
  }

  const updated = await findOwnedTransaction(source.id, userId);
  if (!updated) return notFound('Transaction not found');
  const updatedGroup = await findTransferGroup(updated, userId);
  return ok(toLogicalTransactions(updatedGroup)[0]);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const transaction = await findOwnedTransaction(id, session.user.id);
  if (!transaction) return notFound('Transaction not found');

  const group = await findTransferGroup(transaction, session.user.id);
  let accountIdsToLock = [...new Set(group.map((row) => row.accountId))].sort();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await prisma.$transaction(async (tx) => {
      const lockedAccounts = await lockAccountsInOrder(
        tx,
        accountIdsToLock,
        session.user.id,
      );
      const current = await tx.transaction.findFirst({
        where: { id: transaction.id, account: { userId: session.user.id } },
        select: {
          id: true,
          accountId: true,
          transferGroupId: true,
          transferRole: true,
          account: { select: { userId: true } },
        },
      });
      if (!current) return { status: 'not_found' as const };

      const currentGroup = current.transferGroupId
        ? await tx.transaction.findMany({
            where: { transferGroupId: current.transferGroupId },
            select: {
              id: true,
              accountId: true,
              transferGroupId: true,
              transferRole: true,
              account: { select: { userId: true } },
            },
          })
        : [current];
      if (currentGroup.some((row) => row.account.userId !== session.user.id)) {
        return { status: 'ownership_conflict' as const };
      }

      const requiredAccountIds = [
        ...new Set(currentGroup.map((row) => row.accountId)),
      ].sort();
      const lockedIds = new Set(lockedAccounts.map((candidate) => candidate.id));
      if (requiredAccountIds.some((requiredId) => !lockedIds.has(requiredId))) {
        return { status: 'retry' as const, accountIds: requiredAccountIds };
      }

      const logicalId =
        currentGroup.find((row) => row.transferRole === 'outgoing')?.id ?? current.id;
      if (current.transferGroupId) {
        await tx.transaction.deleteMany({
          where: {
            transferGroupId: current.transferGroupId,
            account: { userId: session.user.id },
          },
        });
      } else {
        await tx.transaction.delete({ where: { id: current.id } });
      }
      return { status: 'deleted' as const, id: logicalId };
    });

    if (result.status === 'retry') {
      accountIdsToLock = result.accountIds;
      continue;
    }
    if (result.status === 'not_found') return notFound('Transaction not found');
    if (result.status === 'ownership_conflict') {
      return fail(
        'Transaction cannot be deleted because its transfer has invalid ownership',
        409,
        'TRANSACTION_DELETE_CONFLICT',
      );
    }
    return ok({ id: result.id, deleted: true });
  }

  return fail(
    'Transfer relationships changed during deletion; try again',
    409,
    'TRANSACTION_DELETE_CONFLICT',
  );
}
