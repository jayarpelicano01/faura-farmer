import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import {
  BACKUP_FORMAT_VERSION,
  backupDocumentSchema,
  backupEntityCounts,
  parseBackupDocumentText,
  type BackupDocument,
  type BackupEntityCounts,
  type BackupRestoreResult,
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
  type MobileSyncMutation,
  type MobileTransaction,
} from '@faura-farmer/types';
import type { DatabaseHandle, LocalBackupSnapshot } from '@/data/db';

type LocalRecord = MobileAccount | MobileBudget | MobileCategory | MobileDebt | MobileDebtAdjustment | MobileDebtCashEvent | MobileDebtPayment | MobileMonthlyBudget | MobilePerson | MobileRecurringRule | MobileTransaction;

const entityNames = ['account', 'category', 'transaction', 'budget', 'monthly_budget', 'recurring_rule', 'person', 'debt', 'debt_adjustment', 'debt_payment', 'debt_cash_event'] as const;

function stable<T extends { id: string; updatedAt: string }>(records: T[]) {
  return [...records].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
}

function overlayMutations(snapshot: LocalBackupSnapshot) {
  const records = new Map<string, Map<string, LocalRecord>>();
  const add = (entity: string, rows: LocalRecord[]) => records.set(entity, new Map(rows.map((row) => [row.id, row])));
  add('account', snapshot.accounts);
  add('category', snapshot.categories);
  add('transaction', snapshot.transactions);
  add('budget', snapshot.budgets);
  add('monthly_budget', snapshot.monthlyBudgets);
  add('recurring_rule', snapshot.recurringRules);
  add('person', snapshot.persons);
  add('debt', snapshot.debts);
  add('debt_adjustment', snapshot.debtAdjustments);
  add('debt_payment', snapshot.debtPayments);
  add('debt_cash_event', snapshot.debtCashEvents);

  for (const mutation of snapshot.mutations) {
    const target = records.get(mutation.entity);
    if (!target) continue;
    if (mutation.operation === 'delete') {
      target.delete(mutation.recordId);
    } else if (mutation.operation === 'upsert') {
      target.set(mutation.recordId, mutation.record as LocalRecord);
    }
  }

  const rows = <T extends LocalRecord>(entity: typeof entityNames[number]) => [...(records.get(entity)?.values() ?? [])] as T[];
  return {
    accounts: stable(rows<MobileAccount>('account')),
    categories: stable(rows<MobileCategory>('category')),
    transactions: stable(rows<MobileTransaction>('transaction')),
    budgets: stable(rows<MobileBudget>('budget')),
    monthlyBudgets: stable(rows<MobileMonthlyBudget>('monthly_budget')),
    recurringRules: stable(rows<MobileRecurringRule>('recurring_rule')),
    persons: stable(rows<MobilePerson>('person')),
    debts: stable(rows<MobileDebt>('debt')),
    debtAdjustments: stable(rows<MobileDebtAdjustment>('debt_adjustment')),
    debtPayments: stable(rows<MobileDebtPayment>('debt_payment')),
    debtCashEvents: stable(rows<MobileDebtCashEvent>('debt_cash_event')),
  };
}

function appVersion() {
  return Constants.expoConfig?.version ?? '0.1.0';
}

function backupExchangeRate(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return String(value);
  const [whole, fraction] = value.toFixed(10).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

export type MobileBackup = {
  document: BackupDocument;
  json: string;
  entityCounts: BackupEntityCounts;
  pendingChangeCount: number;
  latestPendingChangeAt: string | null;
};

export function backupFromLocalSnapshot(snapshot: LocalBackupSnapshot): MobileBackup {
  const now = new Date().toISOString();
  const records = overlayMutations(snapshot);
  const transferGroups = new Map<string, string>();
  const transferGroup = (transactionId: string) => {
    const existing = transferGroups.get(transactionId);
    if (existing) return existing;
    const next = Crypto.randomUUID();
    transferGroups.set(transactionId, next);
    return next;
  };
  const document = backupDocumentSchema.parse({
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId: Crypto.randomUUID(),
    exportedAt: now,
    appVersion: appVersion(),
    containsUnsyncedChanges: snapshot.mutations.length > 0,
    preferences: {
      displayCurrency: snapshot.profile?.displayCurrency ?? 'PHP',
      usdPerPhp: backupExchangeRate(snapshot.profile?.usdPerPhp),
      rateDate: snapshot.profile?.rateDate ?? null,
      rateRefreshedAt: snapshot.profile?.rateRefreshedAt ?? null,
    },
    accounts: records.accounts.map((record) => ({
      id: record.id, label: record.label, type: record.type, institution: record.institution,
      externalAccountId: null, currency: record.currency, startingBalance: record.startingBalance,
      color: record.color, icon: record.icon, isArchived: record.isArchived, createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    categories: records.categories.map((record) => ({
      id: record.id, name: record.name, type: record.type, icon: record.icon, color: record.color,
      bucket: record.bucket, createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    recurringRules: records.recurringRules.map((record) => ({
      id: record.id, accountId: record.accountId, categoryId: record.categoryId, label: record.label,
      amount: record.amount, type: record.type, frequency: record.frequency, nextDueDate: record.nextDueDate, isActive: record.isActive,
    })),
    transactions: records.transactions.flatMap<BackupDocument['transactions'][number]>((record) => {
      const base = {
        accountId: record.accountId, categoryId: record.categoryId, bucket: record.bucket, amount: record.amount,
        type: record.type, date: record.date, note: record.note, source: 'manual' as const,
        externalTransactionId: null, recurringRuleId: record.recurringRuleId ?? null,
        createdAt: record.updatedAt, updatedAt: record.updatedAt,
      };
      if (record.type !== 'transfer') {
        return [{ id: record.id, ...base, transferGroupId: null, transferRole: null }];
      }
      if (!record.destinationAccountId) throw new Error('A local transfer is missing its destination account');
      const group = transferGroup(record.id);
      return [
        { id: record.id, ...base, categoryId: null, bucket: null, recurringRuleId: null, transferGroupId: group, transferRole: 'outgoing' as const },
        {
          id: Crypto.randomUUID(), accountId: record.destinationAccountId, categoryId: null, bucket: null, amount: record.amount,
          type: 'transfer' as const, transferGroupId: group, transferRole: 'incoming' as const, date: record.date,
          note: record.note, source: 'manual' as const, externalTransactionId: null, recurringRuleId: null,
          createdAt: record.updatedAt, updatedAt: record.updatedAt,
        },
      ];
    }),
    budgets: records.budgets.map((record) => ({ id: record.id, categoryId: record.categoryId, monthlyLimit: record.monthlyLimit, createdAt: record.updatedAt })),
    monthlyBudgets: records.monthlyBudgets.map((record) => ({ id: record.id, amount: record.amount })),
    persons: records.persons.map((record) => ({
      id: record.id, displayName: record.displayName, contact: record.contact, note: record.note,
      createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    debts: records.debts.map((record) => ({
      id: record.id, personId: record.personId, direction: record.direction, originalPrincipal: record.originalPrincipal,
      currency: record.currency, status: record.status, openedAt: record.openedAt, dueDate: record.dueDate,
      note: record.note, isHidden: record.isHidden ?? false, createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    debtAdjustments: records.debtAdjustments.map((record) => ({
      id: record.id, debtId: record.debtId, amount: record.amount, reason: record.reason,
      date: record.date, createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    debtPayments: records.debtPayments.map((record) => ({
      id: record.id, debtId: record.debtId, amount: record.amount, date: record.date, note: record.note,
      createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
    debtCashEvents: records.debtCashEvents.map((record) => ({
      id: record.id, debtId: record.debtId, paymentId: record.paymentId, accountId: record.accountId,
      amount: record.amount, direction: record.direction, date: record.date, createdAt: record.updatedAt, updatedAt: record.updatedAt,
    })),
  });
  const json = JSON.stringify(document);
  return {
    document,
    json,
    entityCounts: backupEntityCounts(document),
    pendingChangeCount: snapshot.mutations.length,
    latestPendingChangeAt: snapshot.latestPendingChangeAt,
  };
}

export async function createMobileBackup(db: DatabaseHandle) {
  return backupFromLocalSnapshot(await db.getBackupSnapshot());
}

export function previewMobileBackup(file: string) {
  const document = parseBackupDocumentText(file);
  return { document, entityCounts: backupEntityCounts(document) };
}

/** Previews an additive restore against the current SQLite workspace without changing it. */
export async function previewLocalMobileBackup(db: DatabaseHandle, file: string) {
  const preview = previewMobileBackup(file);
  return { ...preview, restore: await db.previewBackupRestore(preview.document) };
}

/** Restores only missing records in one SQLite transaction. It never queues sync work. */
export async function restoreLocalMobileBackup(db: DatabaseHandle, file: string): Promise<BackupRestoreResult> {
  return db.restoreBackup(previewMobileBackup(file).document);
}
