import { prisma, type Prisma } from '@faura-farmer/database';
import { lockAccountsInOrder, type LockedAccount } from './queries';

type RetryResult = {
  status: 'retry';
  accountIds: string[];
};

type OperationResult = {
  status: string;
};

function isRetryResult(result: OperationResult | RetryResult): result is RetryResult {
  return result.status === 'retry' && 'accountIds' in result;
}

type AccountLockRetryOptions<T extends OperationResult> = {
  initialAccountIds: string[];
  userId: string;
  maxAttempts?: number;
  operation: (
    tx: Prisma.TransactionClient,
    accounts: LockedAccount[],
  ) => Promise<T | RetryResult>;
};

/**
 * Run an account mutation after taking account locks in a stable order.
 *
 * The operation can discover more accounts while it runs and request another
 * attempt with `status: 'retry'`. A null result means the retry budget was
 * exhausted, leaving the route to retain its existing conflict response.
 */
export async function withAccountLockRetry<T extends OperationResult>(
  options: AccountLockRetryOptions<T>,
): Promise<Exclude<T, RetryResult> | null> {
  let accountIds = options.initialAccountIds;
  const maxAttempts = options.maxAttempts ?? 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await prisma.$transaction(async (tx) => {
      const accounts = await lockAccountsInOrder(tx, accountIds, options.userId);
      return options.operation(tx, accounts);
    });

    if (isRetryResult(result)) {
      accountIds = result.accountIds;
      continue;
    }

    return result as Exclude<T, RetryResult>;
  }

  return null;
}
