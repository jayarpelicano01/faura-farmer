import { randomUUID } from 'node:crypto';
import { Prisma, prisma } from '@faura-farmer/database';
import {
  BACKUP_FORMAT_VERSION,
  backupEntityCounts,
  emptyBackupEntityCounts,
  type BackupDocument,
  type BackupEntityCounts,
  type BackupRestorePreview,
} from '@faura-farmer/types';
import { validateBackupFile, type BackupPreview } from './validation';
import { appendBackupRestoreChanges } from '@/lib/mobile/sync';

type TransactionClient = Prisma.TransactionClient;

export type ExportedBackup = {
  document: BackupDocument;
  json: string;
  bytes: number;
};

export type BackupImportReceipt = {
  importedAt: string;
  entityCounts: BackupEntityCounts;
  status: string;
};

export type BackupImportResult = {
  receipt: BackupImportReceipt;
  duplicate: boolean;
};

export class BackupRestoreError extends Error {}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function inputJson(value: BackupEntityCounts): Prisma.InputJsonObject {
  return { ...value };
}

function hasAdditions(counts: BackupEntityCounts) {
  return Object.values(counts).some((count) => count > 0);
}

function receipt(result: { importedAt: Date; entityCounts: Prisma.JsonValue; status: string }): BackupImportReceipt {
  return {
    importedAt: result.importedAt.toISOString(),
    entityCounts: result.entityCounts as unknown as BackupEntityCounts,
    status: result.status,
  };
}

function idMap() {
  const entries = new Map<string, string>();
  return {
    get(source: string) {
      const found = entries.get(source);
      if (!found) throw new Error('Backup references an unmapped record');
      return found;
    },
    add(source: string) {
      const target = randomUUID();
      entries.set(source, target);
      return target;
    },
    values() {
      return [...entries.values()];
    },
    getOrAdd(source: string) {
      const found = entries.get(source);
      if (found) return found;
      const target = randomUUID();
      entries.set(source, target);
      return target;
    },
  };
}

export async function exportBackupForUser(userId: string): Promise<ExportedBackup> {
  const document = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        displayCurrency: true,
        usdPerPhp: true,
        rateDate: true,
        rateRefreshedAt: true,
      },
    });
    if (!user) throw new Error('User not found');

    const accounts = await tx.account.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const categories = await tx.category.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const recurringRules = await tx.recurringRule.findMany({ where: { userId }, orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }] });
    const transactions = await tx.transaction.findMany({ where: { userId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
    const budgets = await tx.budget.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const monthlyBudgets = await tx.monthlyBudget.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    const persons = await tx.person.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const debts = await tx.debt.findMany({ where: { userId }, orderBy: [{ openedAt: 'asc' }, { id: 'asc' }] });
    const debtAdjustments = await tx.debtAdjustment.findMany({ where: { debt: { userId } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] });
    const debtPayments = await tx.debtPayment.findMany({ where: { debt: { userId } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] });
    const debtCashEvents = await tx.debtCashEvent.findMany({ where: { debt: { userId } }, orderBy: [{ date: 'asc' }, { id: 'asc' }] });

    return {
      formatVersion: BACKUP_FORMAT_VERSION,
      backupId: randomUUID(),
      exportedAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version ?? '0.1.0',
      containsUnsyncedChanges: false,
      preferences: {
        displayCurrency: user.displayCurrency === 'USD' ? 'USD' as const : 'PHP' as const,
        usdPerPhp: user.usdPerPhp?.toString() ?? null,
        rateDate: user.rateDate ? dateOnly(user.rateDate) : null,
        rateRefreshedAt: user.rateRefreshedAt?.toISOString() ?? null,
      },
      accounts: accounts.map((record) => ({
        id: record.id,
        label: record.label,
        type: record.type,
        institution: record.institution,
        externalAccountId: record.externalAccountId,
        currency: record.currency as 'PHP' | 'USD',
        startingBalance: record.startingBalance.toString(),
        color: record.color,
        icon: record.icon,
        isArchived: record.isArchived,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      categories: categories.map((record) => ({
        id: record.id,
        name: record.name,
        type: record.type,
        icon: record.icon,
        color: record.color,
        bucket: record.bucket,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      recurringRules: recurringRules.map((record) => ({
        id: record.id,
        accountId: record.accountId,
        categoryId: record.categoryId,
        label: record.label,
        amount: record.amount.toString(),
        type: record.type as 'income' | 'expense',
        frequency: record.frequency,
        nextDueDate: dateOnly(record.nextDueDate),
        isActive: record.isActive,
      })),
      transactions: transactions.map((record) => ({
        id: record.id,
        accountId: record.accountId,
        categoryId: record.categoryId,
        bucket: record.bucket,
        amount: record.amount.toString(),
        type: record.type,
        transferGroupId: record.transferGroupId,
        transferRole: record.transferRole,
        date: dateOnly(record.date),
        note: record.note,
        source: record.source as 'manual' | 'bank_sync' | 'recurring' | 'csv_import',
        externalTransactionId: record.externalTransactionId,
        recurringRuleId: record.recurringRuleId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      budgets: budgets.map((record) => ({
        id: record.id,
        categoryId: record.categoryId,
        monthlyLimit: record.monthlyLimit.toString(),
        createdAt: record.createdAt.toISOString(),
      })),
      monthlyBudgets: monthlyBudgets.map((record) => ({ id: record.id, amount: record.amount.toString() })),
      persons: persons.map((record) => ({
        id: record.id,
        displayName: record.displayName,
        contact: record.contact,
        note: record.note,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      debts: debts.map((record) => ({
        id: record.id,
        personId: record.personId,
        direction: record.direction,
        originalPrincipal: record.originalPrincipal.toString(),
        currency: record.currency as 'PHP' | 'USD',
        status: record.status,
        openedAt: dateOnly(record.openedAt),
        dueDate: record.dueDate ? dateOnly(record.dueDate) : null,
        note: record.note,
        isHidden: record.isHidden,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      debtAdjustments: debtAdjustments.map((record) => ({
        id: record.id,
        debtId: record.debtId,
        amount: record.amount.toString(),
        reason: record.reason as 'correction' | 'agreed_reduction' | 'partial_forgiveness' | 'other',
        date: dateOnly(record.date),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      debtPayments: debtPayments.map((record) => ({
        id: record.id,
        debtId: record.debtId,
        amount: record.amount.toString(),
        date: dateOnly(record.date),
        note: record.note,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      debtCashEvents: debtCashEvents.map((record) => ({
        id: record.id,
        debtId: record.debtId,
        paymentId: record.paymentId,
        accountId: record.accountId,
        amount: record.amount.toString(),
        direction: record.direction as 'in' | 'out',
        date: dateOnly(record.date),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
    } satisfies BackupDocument;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  const parsed = validateBackupFile(JSON.stringify(document));
  const json = JSON.stringify(parsed.document);
  return { document: parsed.document, json, bytes: new TextEncoder().encode(json).byteLength };
}

async function restorePreviewForUser(tx: TransactionClient, userId: string, preview: BackupPreview): Promise<BackupRestorePreview> {
  const existing = await tx.backupImportReceipt.findUnique({
    where: { userId_backupId: { userId, backupId: preview.document.backupId } },
  });
  if (existing) {
    return {
      backupId: preview.document.backupId,
      willAdd: emptyBackupEntityCounts(),
      alreadyPresent: receipt(existing).entityCounts,
      conflicts: [{ code: 'BACKUP_ALREADY_RESTORED', message: 'This backup was already restored in this account.' }],
      canRestore: false,
    };
  }

  const willAdd = backupEntityCounts(preview.document);
  const alreadyPresent = emptyBackupEntityCounts();
  const conflicts: BackupRestorePreview['conflicts'] = [];

  if (preview.document.monthlyBudgets.length > 0) {
    const monthlyBudget = await tx.monthlyBudget.findUnique({ where: { userId }, select: { id: true } });
    if (monthlyBudget) {
      willAdd.monthlyBudgets = 0;
      conflicts.push({ code: 'MONTHLY_BUDGET_EXISTS', message: 'This account already has a monthly budget. Backup restore never replaces existing data.' });
    }
  }

  return {
    backupId: preview.document.backupId,
    willAdd,
    alreadyPresent,
    conflicts,
    canRestore: conflicts.length === 0 && hasAdditions(willAdd),
  };
}

export async function previewBackupForUser(userId: string, file: string): Promise<BackupRestorePreview> {
  const preview = validateBackupFile(file);
  return prisma.$transaction((tx) => restorePreviewForUser(tx, userId, preview), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function restoreBackup(tx: TransactionClient, userId: string, preview: BackupPreview): Promise<BackupImportResult> {
  const existing = await tx.backupImportReceipt.findUnique({
    where: { userId_backupId: { userId, backupId: preview.document.backupId } },
  });
  if (existing) return { receipt: receipt(existing), duplicate: true };

  const restorePlan = await restorePreviewForUser(tx, userId, preview);
  if (!restorePlan.canRestore) {
    const conflict = restorePlan.conflicts[0];
    throw new BackupRestoreError(conflict?.message ?? 'This backup has no new records to restore.');
  }

  const accounts = idMap();
  const categories = idMap();
  const recurringRules = idMap();
  const transactions = idMap();
  const budgets = idMap();
  const monthlyBudgets = idMap();
  const persons = idMap();
  const debts = idMap();
  const adjustments = idMap();
  const payments = idMap();
  const cashEvents = idMap();
  const transferGroups = idMap();

  for (const record of preview.document.accounts) {
    await tx.account.create({ data: {
      id: accounts.add(record.id), userId, label: record.label, type: record.type, institution: record.institution,
      externalAccountId: record.externalAccountId, currency: record.currency, startingBalance: record.startingBalance,
      color: record.color, icon: record.icon, isArchived: record.isArchived, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.categories) {
    await tx.category.create({ data: {
      id: categories.add(record.id), userId, name: record.name, type: record.type, icon: record.icon,
      color: record.color, bucket: record.bucket, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.recurringRules) {
    await tx.recurringRule.create({ data: {
      id: recurringRules.add(record.id), userId, accountId: accounts.get(record.accountId),
      categoryId: record.categoryId ? categories.get(record.categoryId) : null, label: record.label, amount: record.amount,
      type: record.type, frequency: record.frequency, nextDueDate: date(record.nextDueDate), isActive: record.isActive,
    } });
  }
  for (const record of preview.document.transactions) {
    await tx.transaction.create({ data: {
      id: transactions.add(record.id), userId, accountId: accounts.get(record.accountId),
      categoryId: record.categoryId ? categories.get(record.categoryId) : null, bucket: record.bucket, amount: record.amount,
      type: record.type, transferGroupId: record.transferGroupId ? transferGroups.getOrAdd(record.transferGroupId) : null,
      transferRole: record.transferRole, date: date(record.date), note: record.note, source: record.source,
      externalTransactionId: record.externalTransactionId,
      recurringRuleId: record.recurringRuleId ? recurringRules.get(record.recurringRuleId) : null,
      createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.budgets) {
    await tx.budget.create({ data: {
      id: budgets.add(record.id), userId, categoryId: categories.get(record.categoryId),
      monthlyLimit: record.monthlyLimit, createdAt: new Date(record.createdAt),
    } });
  }
  for (const record of preview.document.monthlyBudgets) {
    await tx.monthlyBudget.create({ data: { id: monthlyBudgets.add(record.id), userId, amount: record.amount } });
  }
  for (const record of preview.document.persons) {
    await tx.person.create({ data: {
      id: persons.add(record.id), userId, displayName: record.displayName, contact: record.contact,
      note: record.note, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.debts) {
    await tx.debt.create({ data: {
      id: debts.add(record.id), userId, personId: persons.get(record.personId), direction: record.direction,
      originalPrincipal: record.originalPrincipal, currency: record.currency, status: record.status, openedAt: date(record.openedAt),
      dueDate: record.dueDate ? date(record.dueDate) : null, note: record.note,
      isHidden: record.isHidden,
      createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.debtAdjustments) {
    await tx.debtAdjustment.create({ data: {
      id: adjustments.add(record.id), debtId: debts.get(record.debtId), amount: record.amount, reason: record.reason,
      date: date(record.date), createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.debtPayments) {
    await tx.debtPayment.create({ data: {
      id: payments.add(record.id), debtId: debts.get(record.debtId), amount: record.amount, date: date(record.date),
      note: record.note, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }
  for (const record of preview.document.debtCashEvents) {
    await tx.debtCashEvent.create({ data: {
      id: cashEvents.add(record.id), debtId: debts.get(record.debtId),
      paymentId: record.paymentId ? payments.get(record.paymentId) : null, accountId: accounts.get(record.accountId),
      amount: record.amount, direction: record.direction, date: date(record.date),
      createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
    } });
  }

  await appendBackupRestoreChanges(tx, userId, {
    accounts: accounts.values(),
    categories: categories.values(),
    transactions: transactions.values(),
    budgets: budgets.values(),
    monthlyBudgets: monthlyBudgets.values(),
    recurringRules: recurringRules.values(),
    persons: persons.values(),
    debts: debts.values(),
    debtAdjustments: adjustments.values(),
    debtPayments: payments.values(),
    debtCashEvents: cashEvents.values(),
  });

  const saved = await tx.backupImportReceipt.create({
    data: { userId, backupId: preview.document.backupId, entityCounts: inputJson(backupEntityCounts(preview.document)) },
  });
  return { receipt: receipt(saved), duplicate: false };
}

export async function importBackupForUser(userId: string, file: string): Promise<BackupImportResult> {
  const preview = validateBackupFile(file);
  try {
    return await prisma.$transaction(
      (tx) => restoreBackup(tx, userId, preview),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const existing = await prisma.backupImportReceipt.findUnique({
      where: { userId_backupId: { userId, backupId: preview.document.backupId } },
    });
    if (!existing) throw error;
    return { receipt: receipt(existing), duplicate: true };
  }
}
