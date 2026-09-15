import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  BUDGET_BUCKETS,
  CATEGORY_TYPES,
  DEBT_ADJUSTMENT_REASONS,
  DEBT_CASH_DIRECTIONS,
  DEBT_DIRECTIONS,
  DEBT_STATUSES,
  FREQUENCIES,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
  TRANSFER_ROLES,
} from './models';
import { ACCOUNT_CURRENCIES, DISPLAY_CURRENCIES } from './currency';

export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

const uuid = z.string().uuid();
const dateOnly = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Date must be valid');
const timestamp = z.string().datetime({ offset: true });
const decimal = z.string().regex(/^-?\d+(?:\.\d{1,2})?$/, 'Amount must be a decimal string');
const exchangeRateDecimal = z.string()
  .regex(/^\d+(?:\.\d{1,10})?$/, 'Exchange rate must be a decimal string')
  .refine((value) => !/^0(?:\.0{1,10})?$/.test(value), 'Exchange rate must be positive');
const zeroDecimal = /^-?0(?:\.0{1,2})?$/;
const positiveDecimal = decimal.refine((value) => !value.startsWith('-') && !zeroDecimal.test(value), 'Amount must be positive');
const nonZeroDecimal = decimal.refine((value) => !zeroDecimal.test(value), 'Amount must not be zero');
const canonicalDebtAdjustmentReasons = new Set<string>(DEBT_ADJUSTMENT_REASONS);
const otherDebtAdjustmentReasonPrefix = 'other: ';
const maxDebtAdjustmentReasonDescriptionLength = 240;
const backupDebtAdjustmentReason = z.string().trim().min(1).max(
  otherDebtAdjustmentReasonPrefix.length + maxDebtAdjustmentReasonDescriptionLength,
).refine(
  (value) => canonicalDebtAdjustmentReasons.has(value) || /^other: \S(?:.*\S)?$/.test(value),
  'Reason must be a canonical reason or other: followed by a description',
);

export const backupPreferencesSchema = z.object({
  displayCurrency: z.enum(DISPLAY_CURRENCIES),
  usdPerPhp: exchangeRateDecimal.nullable(),
  rateDate: dateOnly.nullable(),
  rateRefreshedAt: timestamp.nullable(),
}).strict();

export const backupAccountSchema = z.object({
  id: uuid,
  label: z.string().trim().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES),
  institution: z.string().trim().max(120).nullable(),
  externalAccountId: z.string().trim().max(200).nullable(),
  currency: z.enum(ACCOUNT_CURRENCIES),
  startingBalance: decimal,
  color: z.string().trim().max(40).nullable(),
  icon: z.string().trim().max(40).nullable(),
  isArchived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupCategorySchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(120),
  type: z.enum(CATEGORY_TYPES),
  icon: z.string().trim().max(40).nullable(),
  color: z.string().trim().max(40).nullable(),
  bucket: z.enum(BUDGET_BUCKETS).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupRecurringRuleSchema = z.object({
  id: uuid,
  accountId: uuid,
  categoryId: uuid.nullable(),
  label: z.string().trim().max(120).nullable(),
  amount: positiveDecimal,
  type: z.enum(['income', 'expense']),
  frequency: z.enum(FREQUENCIES),
  nextDueDate: dateOnly,
  isActive: z.boolean(),
}).strict();

export const backupTransactionSchema = z.object({
  id: uuid,
  accountId: uuid,
  categoryId: uuid.nullable(),
  bucket: z.enum(BUDGET_BUCKETS).nullable(),
  amount: positiveDecimal,
  type: z.enum(TRANSACTION_TYPES),
  transferGroupId: uuid.nullable(),
  transferRole: z.enum(TRANSFER_ROLES).nullable(),
  date: dateOnly,
  note: z.string().max(500).nullable(),
  source: z.enum(TRANSACTION_SOURCES),
  externalTransactionId: z.string().trim().max(200).nullable(),
  recurringRuleId: uuid.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupBudgetSchema = z.object({
  id: uuid,
  categoryId: uuid,
  monthlyLimit: positiveDecimal,
  createdAt: timestamp,
}).strict();

export const backupMonthlyBudgetSchema = z.object({
  id: uuid,
  amount: positiveDecimal,
}).strict();

export const backupPersonSchema = z.object({
  id: uuid,
  displayName: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(160).nullable(),
  note: z.string().trim().max(500).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupDebtSchema = z.object({
  id: uuid,
  personId: uuid,
  direction: z.enum(DEBT_DIRECTIONS),
  originalPrincipal: positiveDecimal,
  currency: z.enum(ACCOUNT_CURRENCIES),
  status: z.enum(DEBT_STATUSES),
  openedAt: dateOnly,
  dueDate: dateOnly.nullable(),
  note: z.string().trim().max(500).nullable(),
  // Version-one backups created before debt visibility existed remain visible.
  isHidden: z.boolean().optional().default(false),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupDebtAdjustmentSchema = z.object({
  id: uuid,
  debtId: uuid,
  amount: nonZeroDecimal,
  reason: backupDebtAdjustmentReason,
  date: dateOnly,
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupDebtPaymentSchema = z.object({
  id: uuid,
  debtId: uuid,
  amount: positiveDecimal,
  date: dateOnly,
  note: z.string().trim().max(500).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupDebtCashEventSchema = z.object({
  id: uuid,
  debtId: uuid,
  paymentId: uuid.nullable(),
  accountId: uuid,
  amount: positiveDecimal,
  direction: z.enum(DEBT_CASH_DIRECTIONS),
  date: dateOnly,
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

export const backupDocumentSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  backupId: uuid,
  exportedAt: timestamp,
  appVersion: z.string().trim().min(1).max(80),
  containsUnsyncedChanges: z.boolean(),
  preferences: backupPreferencesSchema,
  accounts: z.array(backupAccountSchema).max(100_000),
  categories: z.array(backupCategorySchema).max(100_000),
  transactions: z.array(backupTransactionSchema).max(500_000),
  budgets: z.array(backupBudgetSchema).max(100_000),
  monthlyBudgets: z.array(backupMonthlyBudgetSchema).max(1),
  recurringRules: z.array(backupRecurringRuleSchema).max(100_000),
  persons: z.array(backupPersonSchema).max(100_000),
  debts: z.array(backupDebtSchema).max(100_000),
  debtAdjustments: z.array(backupDebtAdjustmentSchema).max(500_000),
  debtPayments: z.array(backupDebtPaymentSchema).max(500_000),
  debtCashEvents: z.array(backupDebtCashEventSchema).max(500_000),
}).strict();

export type BackupDocument = z.infer<typeof backupDocumentSchema>;

export type BackupEntityCounts = {
  accounts: number;
  categories: number;
  transactions: number;
  budgets: number;
  monthlyBudgets: number;
  recurringRules: number;
  persons: number;
  debts: number;
  debtAdjustments: number;
  debtPayments: number;
  debtCashEvents: number;
};

export type BackupRestoreConflictCode =
  | 'BACKUP_ALREADY_RESTORED'
  | 'BUDGET_CATEGORY_EXISTS'
  | 'MONTHLY_BUDGET_EXISTS';

export type BackupRestoreConflict = {
  code: BackupRestoreConflictCode;
  message: string;
};

/** A destination-specific, additive restore plan. Counts never include overwrites. */
export type BackupRestorePreview = {
  backupId: string;
  willAdd: BackupEntityCounts;
  alreadyPresent: BackupEntityCounts;
  conflicts: BackupRestoreConflict[];
  canRestore: boolean;
};

export type BackupRestoreResult = BackupRestorePreview & {
  added: BackupEntityCounts;
};

export function emptyBackupEntityCounts(): BackupEntityCounts {
  return {
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
  };
}

export function backupEntityCounts(document: BackupDocument): BackupEntityCounts {
  return {
    accounts: document.accounts.length,
    categories: document.categories.length,
    transactions: document.transactions.length,
    budgets: document.budgets.length,
    monthlyBudgets: document.monthlyBudgets.length,
    recurringRules: document.recurringRules.length,
    persons: document.persons.length,
    debts: document.debts.length,
    debtAdjustments: document.debtAdjustments.length,
    debtPayments: document.debtPayments.length,
    debtCashEvents: document.debtCashEvents.length,
  };
}

const prohibitedBackupFields = new Set([
  'password',
  'passwordHash',
  'emailVerified',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'resetToken',
  'receiptUrl',
  'receiptPath',
  'imagePath',
  'attachmentPayload',
  'userId',
]);

export class BackupFormatError extends Error {}

function backupRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function prohibitedField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = prohibitedField(item);
      if (found) return found;
    }
    return null;
  }
  if (!backupRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (prohibitedBackupFields.has(key)) return key;
    const found = prohibitedField(nested);
    if (found) return found;
  }
  return null;
}

function invalidRelation(message: string): never {
  throw new BackupFormatError(`Backup has an invalid relationship: ${message}`);
}

function recordIds(records: Array<{ id: string }>, label: string) {
  const values = new Set<string>();
  for (const record of records) {
    if (values.has(record.id)) invalidRelation(`duplicate ${label} ID`);
    values.add(record.id);
  }
  return values;
}

function requireReference(id: string | null, known: Set<string>, label: string) {
  if (id !== null && !known.has(id)) invalidRelation(`${label} does not exist in this backup`);
}

function validateTransferGroups(document: BackupDocument) {
  const groups = new Map<string, BackupDocument['transactions']>();
  for (const transaction of document.transactions) {
    const isTransfer = transaction.type === 'transfer';
    const hasTransferGroup = transaction.transferGroupId !== null;
    const hasTransferRole = transaction.transferRole !== null;
    if (isTransfer && hasTransferGroup !== hasTransferRole) invalidRelation('linked transfers need both a transfer group and role');
    if (!isTransfer && (transaction.transferGroupId || transaction.transferRole)) invalidRelation('only transfers may have transfer links');
    if (isTransfer && (transaction.categoryId || transaction.bucket || transaction.recurringRuleId)) invalidRelation('transfers cannot have categories, budget buckets, or recurring rules');
    if (!transaction.transferGroupId) continue;
    const group = groups.get(transaction.transferGroupId) ?? [];
    group.push(transaction);
    groups.set(transaction.transferGroupId, group);
  }
  for (const group of groups.values()) {
    const outgoing = group.find((transaction) => transaction.transferRole === 'outgoing');
    const incoming = group.find((transaction) => transaction.transferRole === 'incoming');
    if (group.length !== 2 || !outgoing || !incoming) invalidRelation('each transfer group must have exactly one outgoing and one incoming transaction');
    if (outgoing.accountId === incoming.accountId || outgoing.amount !== incoming.amount) invalidRelation('transfer pairs must use different accounts and matching amounts');
  }
}

/** Validates relationships that span independently valid portable backup records. */
export function validateBackupDocumentRelations(document: BackupDocument) {
  const accountIds = recordIds(document.accounts, 'account');
  const categoryIds = recordIds(document.categories, 'category');
  const recurringRuleIds = recordIds(document.recurringRules, 'recurring rule');
  recordIds(document.budgets, 'budget');
  const personIds = recordIds(document.persons, 'person');
  const debtIds = recordIds(document.debts, 'debt');
  const paymentIds = recordIds(document.debtPayments, 'debt payment');
  recordIds(document.transactions, 'transaction');
  recordIds(document.monthlyBudgets, 'monthly budget');
  recordIds(document.debtAdjustments, 'debt adjustment');
  recordIds(document.debtCashEvents, 'debt cash event');

  for (const rule of document.recurringRules) {
    requireReference(rule.accountId, accountIds, 'recurring rule account');
    requireReference(rule.categoryId, categoryIds, 'recurring rule category');
  }
  for (const transaction of document.transactions) {
    requireReference(transaction.accountId, accountIds, 'transaction account');
    requireReference(transaction.categoryId, categoryIds, 'transaction category');
    requireReference(transaction.recurringRuleId, recurringRuleIds, 'transaction recurring rule');
  }
  const budgetCategories = new Set<string>();
  for (const budget of document.budgets) {
    requireReference(budget.categoryId, categoryIds, 'budget category');
    if (budgetCategories.has(budget.categoryId)) invalidRelation('duplicate budget category');
    budgetCategories.add(budget.categoryId);
  }
  for (const debt of document.debts) requireReference(debt.personId, personIds, 'debt person');
  for (const adjustment of document.debtAdjustments) requireReference(adjustment.debtId, debtIds, 'debt adjustment debt');
  for (const payment of document.debtPayments) requireReference(payment.debtId, debtIds, 'debt payment debt');
  for (const cashEvent of document.debtCashEvents) {
    requireReference(cashEvent.debtId, debtIds, 'debt cash event debt');
    requireReference(cashEvent.paymentId, paymentIds, 'debt cash event payment');
    requireReference(cashEvent.accountId, accountIds, 'debt cash event account');
    if (cashEvent.paymentId) {
      const payment = document.debtPayments.find((candidate) => candidate.id === cashEvent.paymentId);
      if (payment?.debtId !== cashEvent.debtId) invalidRelation('debt cash event payment belongs to a different debt');
    }
  }
  validateTransferGroups(document);
}

/** Parses one portable backup while rejecting secrets and destination ownership fields. */
export function parseBackupDocumentText(file: string): BackupDocument {
  if (new TextEncoder().encode(file).byteLength > MAX_BACKUP_FILE_BYTES) {
    throw new BackupFormatError('Backup files are limited to 5 MB');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(file);
  } catch {
    throw new BackupFormatError('Backup file is not valid JSON');
  }
  const protectedField = prohibitedField(raw);
  if (protectedField) throw new BackupFormatError(`Backup contains prohibited field "${protectedField}"`);
  if (backupRecord(raw) && typeof raw.formatVersion === 'number' && raw.formatVersion !== BACKUP_FORMAT_VERSION) {
    if (raw.formatVersion < BACKUP_FORMAT_VERSION) {
      throw new BackupFormatError('Backup format outdated, please re-export from the source account.');
    }
    throw new BackupFormatError('Backup format is newer than this version. Re-export from a compatible Faura Farmer version.');
  }
  const parsed = backupDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new BackupFormatError(`Backup format is invalid${path}: ${issue?.message ?? 'unknown validation error'}`);
  }
  validateBackupDocumentRelations(parsed.data);
  return parsed.data;
}
