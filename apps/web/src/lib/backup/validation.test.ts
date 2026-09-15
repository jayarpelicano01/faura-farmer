import { describe, expect, it } from 'vitest';
import { validateBackupFile } from './validation';

const backupId = '11111111-1111-4111-8111-111111111111';

function backup(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    formatVersion: 1,
    backupId,
    exportedAt: '2026-09-12T00:00:00.000Z',
    appVersion: '0.1.0',
    containsUnsyncedChanges: false,
    preferences: {
      displayCurrency: 'PHP',
      usdPerPhp: null,
      rateDate: null,
      rateRefreshedAt: null,
    },
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    monthlyBudgets: [],
    recurringRules: [],
    persons: [],
    debts: [],
    debtAdjustments: [],
    debtPayments: [],
    debtCashEvents: [],
    ...overrides,
  });
}

describe('validateBackupFile', () => {
  it('returns preview counts for a valid, empty version-one backup', () => {
    expect(validateBackupFile(backup()).entityCounts).toEqual({
      accounts: 0,
      categories: 0,
      transactions: 0,
      budgets: 0,
      monthlyBudgets: 0,
      recurringRules: 0,
      persons: 0,
      debts: 0,
      debtAdjustments: 0,
      debtPayments: 0,
      debtCashEvents: 0,
    });
  });

  it('rejects auth and ownership fields with an actionable error', () => {
    expect(() => validateBackupFile(backup({ passwordHash: 'never-exported' })))
      .toThrow(/passwordHash/i);
    expect(() => validateBackupFile(backup({ userId: backupId })))
      .toThrow(/userId/i);
  });

  it('rejects unsupported format versions clearly', () => {
    expect(() => validateBackupFile(backup({ formatVersion: 2 })))
      .toThrow(/newer than this version/i);
  });

  it('accepts an unlinked legacy transfer without changing its debit semantics', () => {
    const accountId = '22222222-2222-4222-8222-222222222222';
    const transactionId = '33333333-3333-4333-8333-333333333333';

    expect(() => validateBackupFile(backup({
      accounts: [{
        id: accountId,
        label: 'Cash',
        type: 'cash',
        institution: null,
        externalAccountId: null,
        currency: 'PHP',
        startingBalance: '0',
        color: null,
        icon: null,
        isArchived: false,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }],
      transactions: [{
        id: transactionId,
        accountId,
        categoryId: null,
        bucket: null,
        amount: '100',
        type: 'transfer',
        transferGroupId: null,
        transferRole: null,
        date: '2026-09-12',
        note: 'Legacy transfer',
        source: 'manual',
        externalTransactionId: null,
        recurringRuleId: null,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }],
    }))).not.toThrow();
  });

  it('rejects a partially linked transfer', () => {
    const accountId = '22222222-2222-4222-8222-222222222222';

    expect(() => validateBackupFile(backup({
      accounts: [{
        id: accountId,
        label: 'Cash',
        type: 'cash',
        institution: null,
        externalAccountId: null,
        currency: 'PHP',
        startingBalance: '0',
        color: null,
        icon: null,
        isArchived: false,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }],
      transactions: [{
        id: '33333333-3333-4333-8333-333333333333',
        accountId,
        categoryId: null,
        bucket: null,
        amount: '100',
        type: 'transfer',
        transferGroupId: '44444444-4444-4444-8444-444444444444',
        transferRole: null,
        date: '2026-09-12',
        note: 'Incomplete linked transfer',
        source: 'manual',
        externalTransactionId: null,
        recurringRuleId: null,
        createdAt: '2026-09-12T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
      }],
    }))).toThrow(/both a transfer group and role/i);
  });

  it('accepts legacy debt records without a visibility field as visible', () => {
    const personId = '55555555-5555-4555-8555-555555555555';
    const debtId = '66666666-6666-4666-8666-666666666666';
    const result = validateBackupFile(backup({
      persons: [{
        id: personId,
        displayName: 'Rae',
        contact: null,
        note: null,
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
      debts: [{
        id: debtId,
        personId,
        direction: 'receivable',
        originalPrincipal: '100',
        currency: 'PHP',
        status: 'paid',
        openedAt: '2026-09-14',
        dueDate: null,
        note: null,
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
    }));

    expect(result.document.debts[0]?.isHidden).toBe(false);
  });
});
