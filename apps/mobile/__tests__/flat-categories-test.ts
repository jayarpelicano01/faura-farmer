import type { CurrencyPreference, MobileAccount, MobileBudget, MobileCategory, MobileTransaction } from '@faura-farmer/types';
import { buildBudgetVariance, buildCategorySpending } from '@/data/reports';

const preference: CurrencyPreference = {
  displayCurrency: 'PHP',
  usdPerPhp: null,
  rateDate: null,
  rateRefreshedAt: null,
};
const account: MobileAccount = {
  id: 'account-1', label: 'Cash', type: 'cash', institution: null, currency: 'PHP',
  startingBalance: '0', color: null, icon: null, isArchived: false, updatedAt: '2026-09-11T00:00:00.000Z',
};
const categories: MobileCategory[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Food', type: 'expense', icon: null, color: '#111111', bucket: 'needs', updatedAt: '2026-09-11T00:00:00.000Z' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Produce', type: 'expense', icon: null, color: '#222222', bucket: 'needs', updatedAt: '2026-09-11T00:00:00.000Z' },
];

function expense(categoryId: string, amount: string): MobileTransaction {
  return {
    id: crypto.randomUUID(), accountId: account.id, categoryId, bucket: null, amount,
    type: 'expense', destinationAccountId: null, date: '2026-09-11', note: null,
    updatedAt: '2026-09-11T00:00:00.000Z',
  };
}

describe('flat category calculations', () => {
  it('groups spending by each transaction category directly', () => {
    const rows = buildCategorySpending({
      accountId: account.id,
      accountCurrency: account.currency,
      preference,
      categories,
      transactions: [expense(categories[0]!.id, '10'), expense(categories[1]!.id, '25')],
      period: 'month',
      anchor: '2026-09',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryName: 'Food', amount: '10' }),
      expect.objectContaining({ categoryName: 'Produce', amount: '25' }),
    ]));
  });

  it('counts budget spending only for the budget category', () => {
    const budgets: MobileBudget[] = [{
      id: '20000000-0000-4000-8000-000000000001', categoryId: categories[0]!.id,
      monthlyLimit: '50', updatedAt: '2026-09-11T00:00:00.000Z',
    }];
    const rows = buildBudgetVariance({
      accounts: [account], preference, budgets, categories,
      transactions: [expense(categories[0]!.id, '10'), expense(categories[1]!.id, '25')],
      period: 'month', anchor: '2026-09',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ categoryName: 'Food', spent: '10', remaining: '40' }),
      expect.objectContaining({ categoryName: 'Unbudgeted spending', spent: '25' }),
    ]));
  });
});
