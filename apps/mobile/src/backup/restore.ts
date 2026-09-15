import {
  emptyBackupEntityCounts,
  type BackupDocument,
  type BackupEntityCounts,
  type BackupRestoreConflict,
  type BackupRestorePreview,
  type MobileAccount,
  type MobileBudget,
  type MobileCategory,
  type MobileDebt,
  type MobileDebtAdjustment,
  type MobileDebtCashEvent,
  type MobileDebtPayment,
  type MobileMonthlyBudget,
  type MobilePerson,
  type MobileRecurringRule,
  type MobileTransaction,
} from '@faura-farmer/types';

type IdRecord = { id: string };

/** The local fields used to establish an additive restore plan. */
export type LocalBackupRestoreRecords = {
  accounts: Array<IdRecord>;
  categories: Array<IdRecord>;
  transactions: Array<IdRecord>;
  budgets: Array<IdRecord & { categoryId: string }>;
  monthlyBudgets: Array<IdRecord>;
  recurringRules: Array<IdRecord>;
  persons: Array<IdRecord>;
  debts: Array<IdRecord>;
  debtAdjustments: Array<IdRecord>;
  debtPayments: Array<IdRecord>;
  debtCashEvents: Array<IdRecord>;
};

export type LocalRestoreRecords = {
  accounts: MobileAccount[];
  categories: MobileCategory[];
  transactions: MobileTransaction[];
  budgets: MobileBudget[];
  monthlyBudgets: MobileMonthlyBudget[];
  recurringRules: MobileRecurringRule[];
  persons: MobilePerson[];
  debts: MobileDebt[];
  debtAdjustments: MobileDebtAdjustment[];
  debtPayments: MobileDebtPayment[];
  debtCashEvents: MobileDebtCashEvent[];
};

const recordKeys = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'monthlyBudgets',
  'recurringRules',
  'persons',
  'debts',
  'debtAdjustments',
  'debtPayments',
  'debtCashEvents',
] as const;

type RecordKey = typeof recordKeys[number];

function hasAdditions(counts: BackupEntityCounts) {
  return Object.values(counts).some((count) => count > 0);
}

function markCount(counts: BackupEntityCounts, key: RecordKey) {
  counts[key] += 1;
}

/** Converts portable transfer legs back to one local logical transfer. */
function localTransactions(document: BackupDocument): MobileTransaction[] {
  const transferIncoming = new Map<string, BackupDocument['transactions'][number]>();
  for (const transaction of document.transactions) {
    if (transaction.type === 'transfer' && transaction.transferGroupId && transaction.transferRole === 'incoming') {
      transferIncoming.set(transaction.transferGroupId, transaction);
    }
  }

  return document.transactions.flatMap((transaction) => {
    if (transaction.type === 'transfer' && transaction.transferRole === 'incoming') return [];
    const incoming = transaction.transferGroupId ? transferIncoming.get(transaction.transferGroupId) : null;
    return [{
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      bucket: transaction.bucket,
      amount: transaction.amount,
      type: transaction.type,
      destinationAccountId: incoming?.accountId ?? null,
      recurringRuleId: transaction.recurringRuleId,
      date: transaction.date,
      note: transaction.note,
      updatedAt: transaction.updatedAt,
    }];
  });
}

/** Converts a portable backup into records accepted by the local SQLite repository. */
export function localRestoreRecords(document: BackupDocument, recurringRuleUserId: string): LocalRestoreRecords {
  return {
    accounts: document.accounts.map((record) => ({
      id: record.id,
      label: record.label,
      type: record.type,
      institution: record.institution,
      currency: record.currency,
      startingBalance: record.startingBalance,
      color: record.color,
      icon: record.icon,
      isArchived: record.isArchived,
      updatedAt: record.updatedAt,
    })),
    categories: document.categories.map((record) => ({
      id: record.id,
      name: record.name,
      type: record.type,
      icon: record.icon,
      color: record.color,
      bucket: record.bucket,
      updatedAt: record.updatedAt,
    })),
    transactions: localTransactions(document),
    budgets: document.budgets.map((record) => ({
      id: record.id,
      categoryId: record.categoryId,
      monthlyLimit: record.monthlyLimit,
      updatedAt: record.createdAt,
    })),
    monthlyBudgets: document.monthlyBudgets.map((record) => ({ id: record.id, amount: record.amount, updatedAt: document.exportedAt })),
    recurringRules: document.recurringRules.map((record) => ({
      id: record.id,
      accountId: record.accountId,
      userId: recurringRuleUserId,
      categoryId: record.categoryId,
      label: record.label,
      amount: record.amount,
      type: record.type,
      frequency: record.frequency,
      nextDueDate: record.nextDueDate,
      isActive: record.isActive,
      updatedAt: document.exportedAt,
    })),
    persons: document.persons.map((record) => ({
      id: record.id,
      displayName: record.displayName,
      contact: record.contact,
      note: record.note,
      updatedAt: record.updatedAt,
    })),
    debts: document.debts.map((record) => ({
      id: record.id,
      personId: record.personId,
      direction: record.direction,
      originalPrincipal: record.originalPrincipal,
      currency: record.currency,
      status: record.status,
      openedAt: record.openedAt,
      dueDate: record.dueDate,
      note: record.note,
      isHidden: record.isHidden,
      updatedAt: record.updatedAt,
    })),
    debtAdjustments: document.debtAdjustments.map((record) => ({
      id: record.id,
      debtId: record.debtId,
      amount: record.amount,
      reason: record.reason,
      date: record.date,
      updatedAt: record.updatedAt,
    })),
    debtPayments: document.debtPayments.map((record) => ({
      id: record.id,
      debtId: record.debtId,
      amount: record.amount,
      date: record.date,
      note: record.note,
      updatedAt: record.updatedAt,
    })),
    debtCashEvents: document.debtCashEvents.map((record) => ({
      id: record.id,
      debtId: record.debtId,
      paymentId: record.paymentId,
      accountId: record.accountId,
      amount: record.amount,
      direction: record.direction,
      date: record.date,
      updatedAt: record.updatedAt,
    })),
  };
}

/** Plans a SQLite restore without modifying the destination or its preferences. */
export function planLocalBackupRestore(document: BackupDocument, existing: LocalBackupRestoreRecords): BackupRestorePreview {
  const records = localRestoreRecords(document, '00000000-0000-0000-0000-000000000001');
  const alreadyPresent = emptyBackupEntityCounts();
  const willAdd = emptyBackupEntityCounts();
  const conflicts: BackupRestoreConflict[] = [];
  const ids = new Map<RecordKey, Set<string>>();

  for (const key of recordKeys) ids.set(key, new Set(existing[key].map((record) => record.id)));

  for (const key of recordKeys) {
    for (const record of records[key]) {
      if (ids.get(key)?.has(record.id)) markCount(alreadyPresent, key);
      else markCount(willAdd, key);
    }
  }

  const existingBudgetCategories = new Set(existing.budgets.map((budget) => budget.categoryId));
  const conflictingBudgets = records.budgets.filter((budget) => !ids.get('budgets')?.has(budget.id) && existingBudgetCategories.has(budget.categoryId));
  if (conflictingBudgets.length > 0) {
    willAdd.budgets -= conflictingBudgets.length;
    conflicts.push({
      code: 'BUDGET_CATEGORY_EXISTS',
      message: 'This workspace already has a budget for a restored category. Restore never replaces budgets.',
    });
  }

  const hasExistingMonthlyBudget = existing.monthlyBudgets.length > 0;
  const conflictingMonthlyBudgets = records.monthlyBudgets.filter((budget) => !ids.get('monthlyBudgets')?.has(budget.id) && hasExistingMonthlyBudget);
  if (conflictingMonthlyBudgets.length > 0) {
    willAdd.monthlyBudgets -= conflictingMonthlyBudgets.length;
    conflicts.push({
      code: 'MONTHLY_BUDGET_EXISTS',
      message: 'This workspace already has a monthly budget. Restore never replaces existing data.',
    });
  }

  return {
    backupId: document.backupId,
    willAdd,
    alreadyPresent,
    conflicts,
    canRestore: conflicts.length === 0 && hasAdditions(willAdd),
  };
}
