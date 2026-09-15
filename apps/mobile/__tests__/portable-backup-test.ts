import { backupFromLocalSnapshot, previewMobileBackup } from '@/backup/financial';
import { localRestoreRecords, planLocalBackupRestore } from '@/backup/restore';
import type { LocalBackupSnapshot } from '@/data/db';

jest.mock('expo-crypto', () => ({ randomUUID: () => '44444444-4444-4444-8444-444444444444' }));

const snapshot: LocalBackupSnapshot = {
  profile: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'local@example.com',
    name: 'Local',
    username: null,
    hasPassword: false,
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
  mutations: [],
  latestPendingChangeAt: null,
};

const profile = snapshot.profile;
if (!profile) throw new Error('Portable backup test requires a profile');

describe('portable mobile backup', () => {
  it('creates a shared version-one backup without unsynced changes', () => {
    const backup = backupFromLocalSnapshot(snapshot);

    expect(backup.document.formatVersion).toBe(1);
    expect(backup.document.containsUnsyncedChanges).toBe(false);
    expect(backup.entityCounts).toMatchObject({ accounts: 0, transactions: 0, debts: 0 });
    expect(previewMobileBackup(backup.json).document.backupId).toBe(backup.document.backupId);
  });

  it('marks an export that contains pending outbox mutations', () => {
    const backup = backupFromLocalSnapshot({
      ...snapshot,
      mutations: [{
        mutationId: '22222222-2222-4222-8222-222222222222',
        entity: 'account',
        recordId: '33333333-3333-4333-8333-333333333333',
        operation: 'delete',
        baseCursor: '0',
      }],
    });

    expect(backup.document.containsUnsyncedChanges).toBe(true);
    expect(backup.pendingChangeCount).toBe(1);
  });

  it('serializes the numeric exchange rate returned by SQLite as a decimal string', () => {
    const snapshotWithSqliteRate = {
      ...snapshot,
      profile: {
        ...profile,
        usdPerPhp: 0.018,
      },
    } as unknown as LocalBackupSnapshot;

    const backup = backupFromLocalSnapshot(snapshotWithSqliteRate);

    expect(backup.document.preferences.usdPerPhp).toBe('0.018');
  });

  it('preserves exchange-rate precision beyond two decimal places', () => {
    const backup = backupFromLocalSnapshot({
      ...snapshot,
      profile: {
        ...profile,
        usdPerPhp: '0.018',
      },
    });

    expect(backup.document.preferences.usdPerPhp).toBe('0.018');
  });

  it('plans only missing local records and blocks a conflicting monthly budget', () => {
    const accountId = '22222222-2222-4222-8222-222222222222';
    const categoryId = '33333333-3333-4333-8333-333333333333';
    const document = previewMobileBackup(JSON.stringify({
      ...backupFromLocalSnapshot(snapshot).document,
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
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
      categories: [{
        id: categoryId,
        name: 'Food',
        type: 'expense',
        icon: null,
        color: null,
        bucket: 'needs',
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
      monthlyBudgets: [{ id: '55555555-5555-4555-8555-555555555555', amount: '2000' }],
    })).document;

    const plan = planLocalBackupRestore(document, {
      accounts: [{ id: accountId }],
      categories: [],
      transactions: [],
      budgets: [],
      monthlyBudgets: [{ id: '66666666-6666-4666-8666-666666666666' }],
      recurringRules: [],
      persons: [],
      debts: [],
      debtAdjustments: [],
      debtPayments: [],
      debtCashEvents: [],
    });

    expect(plan.alreadyPresent.accounts).toBe(1);
    expect(plan.willAdd.categories).toBe(1);
    expect(plan.willAdd.monthlyBudgets).toBe(0);
    expect(plan.canRestore).toBe(false);
    expect(plan.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MONTHLY_BUDGET_EXISTS' }),
    ]));
  });

  it('defaults legacy backup debts to visible', () => {
    const personId = '77777777-7777-4777-8777-777777777777';
    const debtId = '88888888-8888-4888-8888-888888888888';
    const document = previewMobileBackup(JSON.stringify({
      ...backupFromLocalSnapshot(snapshot).document,
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
    })).document;

    expect(document.debts[0]?.isHidden).toBe(false);
  });

  it('preserves a custom debt adjustment reason through parsing and restore mapping', () => {
    const personId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const debtId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const document = previewMobileBackup(JSON.stringify({
      ...backupFromLocalSnapshot(snapshot).document,
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
        status: 'open',
        openedAt: '2026-09-14',
        dueDate: null,
        note: null,
        isHidden: false,
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
      debtAdjustments: [{
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        debtId,
        amount: '-10',
        reason: 'other: addition',
        date: '2026-09-14',
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      }],
    })).document;

    expect(document.debtAdjustments[0]?.reason).toBe('other: addition');
    expect(localRestoreRecords(document, profile.id).debtAdjustments[0]?.reason).toBe('other: addition');
  });

  it('rejects a local restore preview with a missing record reference', () => {
    expect(() => previewMobileBackup(JSON.stringify({
      ...backupFromLocalSnapshot(snapshot).document,
      recurringRules: [{
        id: '99999999-9999-4999-8999-999999999999',
        accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        categoryId: null,
        label: 'Rent',
        amount: '1000',
        type: 'expense',
        frequency: 'monthly',
        nextDueDate: '2026-10-01',
        isActive: true,
      }],
    }))).toThrow(/relationship/i);
  });
});
