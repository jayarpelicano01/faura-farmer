import type { MobileAccount, MobileDebtCashEvent, MobileTransaction } from '@faura-farmer/types';
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

  it('includes dedicated debt cash events without treating them as spending', () => {
    const events: MobileDebtCashEvent[] = [
      { id: '20000000-0000-4000-8000-000000000001', debtId: '20000000-0000-4000-8000-000000000002', paymentId: null, accountId: account.id, amount: '40', direction: 'in', date: '2026-09-11', updatedAt: '2026-09-11T00:00:00.000Z' },
      { id: '20000000-0000-4000-8000-000000000003', debtId: '20000000-0000-4000-8000-000000000002', paymentId: null, accountId: account.id, amount: '15', direction: 'out', date: '2026-09-11', updatedAt: '2026-09-11T00:00:00.000Z' },
    ];
    expect(currentBalance(account, [], events)).toBe(125);
  });
});
