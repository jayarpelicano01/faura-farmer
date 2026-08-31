import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { updateAccountSchema } from '@/lib/validations';
import { badRequest, fail, notFound, ok, unauthorized } from '@/lib/http';
import { toNumber } from '@/lib/format';
import { lockAccountsInOrder } from '@/lib/queries';
import { guardMutation, readJsonBody } from '@/lib/security';

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
    by: ['type', 'transferRole'],
    where: { accountId: account.id },
    _sum: { amount: true },
  });
  for (const row of grouped) {
    if (row.type === 'income' || (row.type === 'transfer' && row.transferRole === 'incoming')) {
      net += toNumber(row._sum.amount);
    } else {
      net -= toNumber(row._sum.amount);
    }
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

  const requestedCurrency = parsed.data.currency;
  if (requestedCurrency !== undefined) {
    let accountIdsToLock = [account.id];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await prisma.$transaction(async (tx) => {
        const lockedAccounts = await lockAccountsInOrder(
          tx,
          accountIdsToLock,
          session.user.id,
        );
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
          data: parsed.data,
        });
        return { status: 'updated' as const, account: updated };
      });

      if (result.status === 'retry') {
        accountIdsToLock = result.accountIds;
        continue;
      }
      if (result.status === 'not_found') return notFound('Account not found');
      if (result.status === 'currency_conflict') {
        return fail(
          'Currency cannot be changed because this account has linked transfers in another currency',
          409,
          'TRANSFER_CURRENCY_CONFLICT',
        );
      }

      return ok({
        ...result.account,
        startingBalance: String(result.account.startingBalance),
      });
    }

    return fail(
      'Account transfer relationships changed during the update; try again',
      409,
      'ACCOUNT_UPDATE_CONFLICT',
    );
  }

  const updated = await prisma.account.update({ where: { id: account.id }, data: parsed.data });
  return ok({ ...updated, startingBalance: String(updated.startingBalance) });
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

  let accountIdsToLock = [account.id];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await prisma.$transaction(async (tx) => {
      const lockedAccounts = await lockAccountsInOrder(
        tx,
        accountIdsToLock,
        session.user.id,
      );
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

      await tx.transaction.deleteMany({
        where:
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
            : { accountId: account.id },
      });
      await tx.recurringRule.deleteMany({ where: { accountId: account.id } });
      await tx.account.delete({ where: { id: account.id } });
      return { status: 'deleted' as const };
    });

    if (result.status === 'retry') {
      accountIdsToLock = result.accountIds;
      continue;
    }
    if (result.status === 'not_found') return notFound('Account not found');
    if (result.status === 'ownership_conflict') {
      return fail(
        'Account cannot be deleted because a linked transfer has invalid ownership',
        409,
        'ACCOUNT_DELETE_CONFLICT',
      );
    }
    return ok({ id: account.id, deleted: true });
  }

  return fail(
    'Account transfer relationships changed during deletion; try again',
    409,
    'ACCOUNT_DELETE_CONFLICT',
  );
}
