import type { MobileAccount, MobileTransaction } from '@faura-farmer/types';
import { currentBalance } from '@/data/current-balance';

const account: MobileAccount = {
  id: 'account-1', label: 'Cash', type: 'cash', institution: null, currency: 'PHP',
  startingBalance: '100', color: null, icon: null, isArchived: false, updatedAt: '2026-09-11T00:00:00.000Z',
};

const transaction = (overrides: Partial<MobileTransaction>): MobileTransaction => ({
  id: crypto.randomUUID(), accountId: 'account-1', categoryId: null, bucket: null,
  amount: '0', type: 'expense', destinationAccountId: null, date: '2026-09-11',
  note: null, updatedAt: '2026-09-11T00:00:00.000Z', ...overrides,
});

describe('currentBalance', () => {
  it('applies income, expenses, and both transfer directions', () => {
    expect(currentBalance(account, [
      transaction({ type: 'income', amount: '50' }),
      transaction({ type: 'expense', amount: '10' }),
      transaction({ type: 'transfer', amount: '20' }),
      transaction({ id: 'incoming', accountId: 'other', destinationAccountId: 'account-1', type: 'transfer', amount: '5' }),
    ])).toBe(125);
  });
});
