import type { CurrencyPreference, MobileAccount, MobileCategory, MobileDebtCashEvent, MobileTransaction } from '@faura-farmer/types';
import { buildCategorySpending, buildCombinedBalanceTimeline } from '@/data/reports';

const preference: CurrencyPreference = { displayCurrency: 'PHP', usdPerPhp: null, rateDate: null, rateRefreshedAt: null };
const accounts: MobileAccount[] = [
  { id: '10000000-0000-4000-8000-000000000001', label: 'Cash', type: 'cash', institution: null, currency: 'PHP', startingBalance: '100', color: null, icon: null, isArchived: false, updatedAt: '2026-09-11T00:00:00.000Z' },
  { id: '10000000-0000-4000-8000-000000000002', label: 'Bank', type: 'bank', institution: null, currency: 'PHP', startingBalance: '200', color: null, icon: null, isArchived: false, updatedAt: '2026-09-11T00:00:00.000Z' },
];
const categories: MobileCategory[] = [{ id: '10000000-0000-4000-8000-000000000003', name: 'Food', type: 'expense', icon: null, color: '#111111', bucket: 'needs', updatedAt: '2026-09-11T00:00:00.000Z' }];
const transactions: MobileTransaction[] = [{ id: '10000000-0000-4000-8000-000000000004', accountId: accounts[0]!.id, categoryId: categories[0]!.id, bucket: null, amount: '25', type: 'expense', destinationAccountId: null, date: '2026-09-11', note: null, updatedAt: '2026-09-11T00:00:00.000Z' }];
const timelineAnchor = new Date(2026, 8, 11, 12);

describe('mobile report account selection', () => {
  it('aggregates category spending when All accounts is selected', () => {
    expect(buildCategorySpending({ accountId: null, accounts, preference, categories, transactions, period: 'month', anchor: '2026-09' })).toEqual([
      expect.objectContaining({ categoryName: 'Food', amount: '25' }),
    ]);
  });

  it('sums closing balances for the All accounts timeline', () => {
    const timeline = buildCombinedBalanceTimeline({ accounts, categories, transactions, period: '7d', preference, anchor: timelineAnchor });
    expect(timeline).toHaveLength(7);
    expect(timeline.at(-1)).toEqual(expect.objectContaining({ balance: '275', change: '-25' }));
  });

  it('assigns distinct event identities to both legs of an All accounts transfer', () => {
    const transfer: MobileTransaction = {
      id: '10000000-0000-4000-8000-000000000005', accountId: accounts[0]!.id, categoryId: null, bucket: null,
      amount: '40', type: 'transfer', destinationAccountId: accounts[1]!.id, date: '2026-09-11', note: null,
      updatedAt: '2026-09-11T00:00:00.000Z',
    };
    const timeline = buildCombinedBalanceTimeline({ accounts, categories, transactions: [transfer], period: '7d', preference, anchor: timelineAnchor });
    const events = timeline.at(-1)!.events;

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: transfer.id, accountId: accounts[0]!.id, change: '-40' }),
      expect.objectContaining({ id: transfer.id, accountId: accounts[1]!.id, change: '40' }),
    ]));
    expect(new Set(events.map((event) => `${event.accountId}:${event.id}`)).size).toBe(events.length);
  });

  it('includes debt cash in balance movement without adding category spending', () => {
    const cashEvent: MobileDebtCashEvent = {
      id: '10000000-0000-4000-8000-000000000006', debtId: '10000000-0000-4000-8000-000000000007', paymentId: null,
      accountId: accounts[0]!.id, amount: '30', direction: 'in', date: '2026-09-11', updatedAt: '2026-09-11T00:00:00.000Z',
    };
    const timeline = buildCombinedBalanceTimeline({ accounts, categories, debtCashEvents: [cashEvent], transactions: [], period: '7d', preference, anchor: timelineAnchor });
    expect(timeline.at(-1)).toEqual(expect.objectContaining({ balance: '330', change: '30' }));
    expect(timeline.at(-1)!.events).toEqual(expect.arrayContaining([expect.objectContaining({ id: cashEvent.id, kind: 'debt_in' })]));
  });
});
