import { describe, expect, it } from 'vitest';
import { accountBalance, computeNetFromGrouped } from './balance';

describe('computeNetFromGrouped', () => {
  it('adds income and incoming transfers while subtracting expenses and outgoing transfers', () => {
    expect(computeNetFromGrouped([
      { type: 'income', transferRole: null, _sum: { amount: '100' } },
      { type: 'expense', transferRole: null, _sum: { amount: '25' } },
      { type: 'transfer', transferRole: 'incoming', _sum: { amount: '50' } },
      { type: 'transfer', transferRole: 'outgoing', _sum: { amount: '10' } },
    ])).toBe(115);
  });

  it('returns zero for no grouped transactions and adds the opening balance', () => {
    expect(computeNetFromGrouped([])).toBe(0);
    expect(accountBalance('42.5', -2.5)).toBe(40);
  });
});
