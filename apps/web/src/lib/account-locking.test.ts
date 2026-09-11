import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.fn();
const lockAccountsInOrder = vi.fn();

vi.mock('@faura-farmer/database', () => ({ prisma: { $transaction: transaction } }));
vi.mock('./queries', () => ({ lockAccountsInOrder }));

import { withAccountLockRetry } from './account-locking';

describe('withAccountLockRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (operation) => operation({}));
    lockAccountsInOrder.mockResolvedValue([{ id: 'account-1', userId: 'user-1', currency: 'PHP' }]);
  });

  it('retries with the discovered account ids and returns the non-retry result', async () => {
    const operation = vi.fn()
      .mockResolvedValueOnce({ status: 'retry' as const, accountIds: ['account-1', 'account-2'] })
      .mockResolvedValueOnce({ status: 'updated' as const, id: 'transaction-1' });

    await expect(withAccountLockRetry({ initialAccountIds: ['account-1'], userId: 'user-1', operation }))
      .resolves.toEqual({ status: 'updated', id: 'transaction-1' });
    expect(lockAccountsInOrder).toHaveBeenNthCalledWith(1, {}, ['account-1'], 'user-1');
    expect(lockAccountsInOrder).toHaveBeenNthCalledWith(2, {}, ['account-1', 'account-2'], 'user-1');
  });

  it('returns null after the retry budget is exhausted', async () => {
    const operation = vi.fn().mockResolvedValue({ status: 'retry' as const, accountIds: ['account-1'] });

    await expect(withAccountLockRetry({ initialAccountIds: ['account-1'], userId: 'user-1', operation }))
      .resolves.toBeNull();
    expect(operation).toHaveBeenCalledTimes(4);
  });
});
