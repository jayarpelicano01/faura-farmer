import { Prisma, prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateAccountSchema } from '@/lib/validations';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';
import { accountBalance, computeDebtCashNet, computeNetFromGrouped } from '@/lib/balance';
import { withAccountLockRetry } from '@/lib/account-locking';
import { guardMutation, readJsonBody } from '@/lib/security';
import { recordCanonicalMobileTombstone, recordCanonicalMobileUpsert } from '@/lib/mobile/sync';

async function createBalanceAdjustment(
  tx: Prisma.TransactionClient,
  userId: string,
  accountId: string,
  startingBalance: Prisma.Decimal,
  targetBalance: number,
) {
  const [grouped, debtCashGrouped] = await Promise.all([
    tx.transaction.groupBy({
      by: ['type', 'transferRole'],
      where: { accountId, userId },
      _sum: { amount: true },
    }),
    tx.debtCashEvent.groupBy({
      by: ['direction'],
      where: { accountId, debt: { userId } },
      _sum: { amount: true },
    }),
  ]);
  const net = computeNetFromGrouped(grouped) + computeDebtCashNet(debtCashGrouped);
  const difference = Math.round((targetBalance - accountBalance(startingBalance, net)) * 100) / 100;
  if (Math.abs(difference) < 0.005) return null;
  return tx.transaction.create({
    data: {
      userId,
      accountId,
      categoryId: null,
      bucket: null,
      amount: Math.abs(difference).toFixed(2),
      type: difference > 0 ? 'income' : 'expense',
      date: new Date(),
      note: 'Balance adjustment',
      source: 'manual',
    },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  const [grouped, debtCashGrouped] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type', 'transferRole'],
      where: { accountId: account.id },
      _sum: { amount: true },
    }),
    prisma.debtCashEvent.groupBy({
      by: ['direction'],
      where: { accountId: account.id, debt: { userId: session.user.id } },
      _sum: { amount: true },
    }),
  ]);
  return ok({
    ...account,
    startingBalance: String(account.startingBalance),
    balance: String(accountBalance(account.startingBalance, computeNetFromGrouped(grouped) + computeDebtCashNet(debtCashGrouped))),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'account-write', session.user.id);
  if (securityFailure) return securityFailure;

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  const bodyResult = await readJsonBody(request);
  if ('response' in bodyResult) return bodyResult.response;
  const parsed = updateAccountSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input');
  }

  const { currentBalance, ...accountData } = parsed.data;

  const requestedCurrency = accountData.currency;
  if (requestedCurrency !== undefined) {
    const result = await withAccountLockRetry({
      initialAccountIds: [account.id],
      userId: session.user.id,
      operation: async (tx, lockedAccounts) => {
        const lockedAccount = lockedAccounts.find((candidate) => candidate.id === account.id);
        if (!lockedAccount || lockedAccount.userId !== session.user.id) {
          return { status: 'not_found' as const };
        }

        const linkedTransfers = await tx.transaction.findMany({
          where: { accountId: account.id, transferGroupId: { not: null } },
          select: { transferGroupId: true },
        });
        const transferGroupIds = [
          ...new Set(
            linkedTransfers.flatMap((row) =>
              row.transferGroupId ? [row.transferGroupId] : [],
            ),
          ),
        ];
        const linkedRows =
          transferGroupIds.length > 0
            ? await tx.transaction.findMany({
                where: { transferGroupId: { in: transferGroupIds } },
                select: { accountId: true, account: { select: { userId: true } } },
              })
            : [];
        if (linkedRows.some((row) => row.account.userId !== session.user.id)) {
          return { status: 'currency_conflict' as const };
        }
        const requiredAccountIds = [
          ...new Set([account.id, ...linkedRows.map((row) => row.accountId)]),
        ].sort();
        const lockedIds = new Set(lockedAccounts.map((candidate) => candidate.id));

        if (requiredAccountIds.some((requiredId) => !lockedIds.has(requiredId))) {
          return { status: 'retry' as const, accountIds: requiredAccountIds };
        }

        const normalizedCurrency = requestedCurrency.toUpperCase();
        const createsCurrencyConflict = lockedAccounts.some(
          (candidate) =>
            requiredAccountIds.includes(candidate.id) &&
            candidate.id !== account.id &&
            (candidate.userId !== session.user.id ||
              candidate.currency.toUpperCase() !== normalizedCurrency),
        );
        if (createsCurrencyConflict) {
          return { status: 'currency_conflict' as const };
        }

        const updated = await tx.account.update({
          where: { id: account.id },
          data: accountData,
        });
        const adjustment = currentBalance === undefined
          ? null
          : await createBalanceAdjustment(tx, session.user.id, updated.id, updated.startingBalance, currentBalance);
        return { status: 'updated' as const, account: updated, adjustmentId: adjustment?.id ?? null };
      },
    });

    if (!result) {
      return fail(
        'Account transfer relationships changed during the update; try again',
        409,
        'ACCOUNT_UPDATE_CONFLICT',
      );
    }
    if (result.status === 'not_found') return notFound('Account not found');
    if (result.status === 'currency_conflict') {
      return fail(
        'Currency cannot be changed because this account has linked transfers in another currency',
        409,
        'TRANSFER_CURRENCY_CONFLICT',
      );
    }

    await recordCanonicalMobileUpsert(session.user.id, 'account', result.account.id);
    if (result.adjustmentId) await recordCanonicalMobileUpsert(session.user.id, 'transaction', result.adjustmentId);
    return ok({
      ...result.account,
      startingBalance: String(result.account.startingBalance),
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({ where: { id: account.id }, data: accountData });
    const adjustment = currentBalance === undefined
      ? null
      : await createBalanceAdjustment(tx, session.user.id, updated.id, updated.startingBalance, currentBalance);
    return { updated, adjustmentId: adjustment?.id ?? null };
  });
  await recordCanonicalMobileUpsert(session.user.id, 'account', result.updated.id);
  if (result.adjustmentId) await recordCanonicalMobileUpsert(session.user.id, 'transaction', result.adjustmentId);
  return ok({ ...result.updated, startingBalance: String(result.updated.startingBalance) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return unauthorized();

  const securityFailure = await guardMutation(request, 'account-write', session.user.id);
  if (securityFailure) return securityFailure;

  const account = await prisma.account.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!account) return notFound('Account not found');

  const result = await withAccountLockRetry({
    initialAccountIds: [account.id],
    userId: session.user.id,
    operation: async (tx, lockedAccounts) => {
      if (!lockedAccounts.some((candidate) => candidate.id === account.id)) {
        return { status: 'not_found' as const };
      }

      const linkedTransfers = await tx.transaction.findMany({
        where: { accountId: account.id, transferGroupId: { not: null } },
        select: { transferGroupId: true },
      });
      const transferGroupIds = [
        ...new Set(
          linkedTransfers.flatMap((row) =>
            row.transferGroupId ? [row.transferGroupId] : [],
          ),
        ),
      ];
      const linkedRows =
        transferGroupIds.length > 0
          ? await tx.transaction.findMany({
              where: { transferGroupId: { in: transferGroupIds } },
              select: { accountId: true, account: { select: { userId: true } } },
            })
          : [];
      if (linkedRows.some((row) => row.account.userId !== session.user.id)) {
        return { status: 'ownership_conflict' as const };
      }

      const requiredAccountIds = [
        ...new Set([account.id, ...linkedRows.map((row) => row.accountId)]),
      ].sort();
      const lockedIds = new Set(lockedAccounts.map((candidate) => candidate.id));
      if (requiredAccountIds.some((requiredId) => !lockedIds.has(requiredId))) {
        return { status: 'retry' as const, accountIds: requiredAccountIds };
      }

      const transactionsWhere =
        transferGroupIds.length > 0
          ? {
              OR: [
                { accountId: account.id },
                {
                  transferGroupId: { in: transferGroupIds },
                  account: { userId: session.user.id },
                },
              ],
            }
          : { accountId: account.id };
      const transactions = await tx.transaction.findMany({
        where: transactionsWhere,
        select: { id: true, transferGroupId: true, transferRole: true },
      });
      const recurringRules = await tx.recurringRule.findMany({
        where: { accountId: account.id, userId: session.user.id },
        select: { id: true },
      });
      await tx.transaction.deleteMany({ where: transactionsWhere });
      await tx.recurringRule.deleteMany({ where: { accountId: account.id } });
      await tx.account.delete({ where: { id: account.id } });
      return {
        status: 'deleted' as const,
        deletedTransactionIds: transactions
          .filter((transaction) => !transaction.transferGroupId || transaction.transferRole === 'outgoing')
          .map((transaction) => transaction.id),
        deletedRecurringRuleIds: recurringRules.map((rule) => rule.id),
      };
    },
  });

  if (!result) {
    return fail(
      'Account transfer relationships changed during deletion; try again',
      409,
      'ACCOUNT_DELETE_CONFLICT',
    );
  }
  if (result.status === 'not_found') return notFound('Account not found');
  if (result.status === 'ownership_conflict') {
    return fail(
      'Account cannot be deleted because a linked transfer has invalid ownership',
      409,
      'ACCOUNT_DELETE_CONFLICT',
    );
  }
  for (const transactionId of result.deletedTransactionIds) {
    await recordCanonicalMobileTombstone(session.user.id, 'transaction', transactionId);
  }
  for (const recurringRuleId of result.deletedRecurringRuleIds) {
    await recordCanonicalMobileTombstone(session.user.id, 'recurring_rule', recurringRuleId);
  }
  await recordCanonicalMobileTombstone(session.user.id, 'account', account.id);
  return ok({ id: account.id, deleted: true });
}
