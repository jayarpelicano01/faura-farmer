import { describe, expect, it } from 'vitest';
import { calculateDebtState, summarizeDebtBalances } from './debt-ledger';

describe('debt ledger calculation seam', () => {
  it('derives an outstanding balance and partial-payment status from auditable entries', () => {
    expect(calculateDebtState({
      originalPrincipal: '1000.00',
      adjustments: [{ amount: '-100.00' }],
      payments: [{ amount: '300.00' }],
    })).toEqual({ outstandingBalance: '600.00', status: 'partially_paid' });
  });

  it('marks a fully settled debt as paid and keeps written-off debts closed', () => {
    expect(calculateDebtState({
      originalPrincipal: '1000.00',
      adjustments: [],
      payments: [{ amount: '1000.00' }],
    })).toEqual({ outstandingBalance: '0.00', status: 'paid' });

    expect(calculateDebtState({
      originalPrincipal: '1000.00',
      adjustments: [],
      payments: [],
      status: 'written_off',
    })).toEqual({ outstandingBalance: '1000.00', status: 'written_off' });
  });

  it('converts receivables and payables into one display-currency summary', () => {
    expect(summarizeDebtBalances([
      { direction: 'receivable', currency: 'PHP', outstandingBalance: '1000.00' },
      { direction: 'payable', currency: 'USD', outstandingBalance: '10.00' },
    ], { displayCurrency: 'PHP', usdPerPhp: '0.02', rateDate: null, rateRefreshedAt: null }))
      .toEqual({ owedToYou: '1000.00', youOwe: '500.00', netPosition: '500.00' });
  });
});
