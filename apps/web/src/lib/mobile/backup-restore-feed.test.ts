import { describe, expect, it, vi } from 'vitest';
import { appendBackupRestoreChanges } from './sync';

const userId = '00000000-0000-4000-8000-000000000001';
const accountId = '00000000-0000-4000-8000-000000000002';
const destinationAccountId = '00000000-0000-4000-8000-000000000003';
const categoryId = '00000000-0000-4000-8000-000000000004';
const transferId = '00000000-0000-4000-8000-000000000005';
const incomingTransferId = '00000000-0000-4000-8000-000000000006';
const transferGroupId = '00000000-0000-4000-8000-000000000007';
const recurringRuleId = '00000000-0000-4000-8000-000000000008';
const budgetId = '00000000-0000-4000-8000-000000000009';
const monthlyBudgetId = '00000000-0000-4000-8000-000000000010';
const personId = '00000000-0000-4000-8000-000000000011';
const debtId = '00000000-0000-4000-8000-000000000012';
const adjustmentId = '00000000-0000-4000-8000-000000000013';
const paymentId = '00000000-0000-4000-8000-000000000014';
const cashEventId = '00000000-0000-4000-8000-000000000015';

const date = new Date('2026-09-15T00:00:00.000Z');
const decimal = { toString: () => '100' };

function fakeTransactionClient() {
  const changes: Array<{ entity: string; recordId: string; data: Record<string, unknown> }> = [];
  const findMany = (records: unknown[]) => vi.fn().mockResolvedValue(records);
  return {
    changes,
    tx: {
      account: { findMany: findMany([
        { id: accountId, label: 'Cash', type: 'cash', institution: null, currency: 'PHP', startingBalance: decimal, color: null, icon: null, isArchived: false, updatedAt: date },
        { id: destinationAccountId, label: 'Bank', type: 'bank', institution: null, currency: 'PHP', startingBalance: decimal, color: null, icon: null, isArchived: false, updatedAt: date },
      ]) },
      category: { findMany: findMany([{ id: categoryId, name: 'Food', type: 'expense', icon: null, color: null, bucket: 'needs', updatedAt: date }]) },
      recurringRule: { findMany: findMany([{ id: recurringRuleId, accountId, userId, categoryId, label: 'Rent', amount: decimal, type: 'expense', frequency: 'monthly', nextDueDate: date, isActive: true }]) },
      transaction: { findMany: findMany([
        { id: transferId, userId, accountId, categoryId: null, bucket: null, amount: decimal, type: 'transfer', transferGroupId, transferRole: 'outgoing', date, note: 'Move money', recurringRuleId: null, updatedAt: date },
        { id: incomingTransferId, userId, accountId: destinationAccountId, categoryId: null, bucket: null, amount: decimal, type: 'transfer', transferGroupId, transferRole: 'incoming', date, note: 'Move money', recurringRuleId: null, updatedAt: date },
      ]) },
      budget: { findMany: findMany([{ id: budgetId, categoryId, monthlyLimit: decimal }]) },
      monthlyBudget: { findMany: findMany([{ id: monthlyBudgetId, amount: decimal }]) },
      person: { findMany: findMany([{ id: personId, displayName: 'Rae', contact: null, note: null, updatedAt: date }]) },
      debt: { findMany: findMany([{ id: debtId, personId, direction: 'receivable', originalPrincipal: decimal, currency: 'PHP', status: 'open', openedAt: date, dueDate: null, note: null, isHidden: false, updatedAt: date }]) },
      debtAdjustment: { findMany: findMany([{ id: adjustmentId, debtId, amount: decimal, reason: 'correction', date, updatedAt: date }]) },
      debtPayment: { findMany: findMany([{ id: paymentId, debtId, amount: decimal, date, note: null, updatedAt: date }]) },
      debtCashEvent: { findMany: findMany([{ id: cashEventId, debtId, paymentId, accountId, amount: decimal, direction: 'in', date, updatedAt: date }]) },
      mobileSyncChange: { create: vi.fn(async ({ data }: { data: { entity: string; recordId: string; data: Record<string, unknown> } }) => { changes.push(data); return data; }) },
    },
  };
}

describe('backup restore mobile change feed publication', () => {
  it('publishes every imported entity and preserves a transfer pair as one mobile transfer', async () => {
    const { tx, changes } = fakeTransactionClient();

    await appendBackupRestoreChanges(tx as never, userId, {
      accounts: [accountId, destinationAccountId],
      categories: [categoryId],
      transactions: [transferId, incomingTransferId],
      budgets: [budgetId],
      monthlyBudgets: [monthlyBudgetId],
      recurringRules: [recurringRuleId],
      persons: [personId],
      debts: [debtId],
      debtAdjustments: [adjustmentId],
      debtPayments: [paymentId],
      debtCashEvents: [cashEventId],
    });

    expect(changes.map(({ entity }) => entity)).toEqual([
      'account', 'account', 'category', 'recurring_rule', 'transaction', 'budget',
      'monthly_budget', 'person', 'debt', 'debt_adjustment', 'debt_payment', 'debt_cash_event',
    ]);
    expect(changes.find(({ entity }) => entity === 'transaction')).toMatchObject({
      recordId: transferId,
      data: expect.objectContaining({ destinationAccountId }),
    });
  });
});
