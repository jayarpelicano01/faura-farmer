import { randomUUID } from 'node:crypto';
import { Prisma, prisma } from '@faura-farmer/database';
import {
  mobileAccountSchema,
  mobileCategorySchema,
  mobileTransactionSchema,
  type MobileAccount,
  type MobileCategory,
  type MobileSyncChange,
  type MobileSyncMutation,
  type MobileTransaction,
} from '@faura-farmer/types';
import { lockAccountsInOrder } from '@/lib/queries';

type Tx = Prisma.TransactionClient;
type Entity = 'account' | 'category' | 'transaction';
type MutationResult =
  | { mutationId: string; status: 'accepted'; entity: Entity; recordId: string; operation: 'upsert' | 'delete'; record?: MobileAccount | MobileCategory | MobileTransaction }
  | { mutationId: string; status: 'rejected'; code: string; message: string };

class SyncRejection extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function isOwned(existing: { userId: string } | null, userId: string) {
  if (existing && existing.userId !== userId) throw new SyncRejection('RECORD_ID_CONFLICT', 'Record ID is already in use');
}

function requireRecord<T>(value: { success: boolean; data?: T }) {
  if (!value.success || !value.data) throw new SyncRejection('INVALID_MUTATION', 'Mutation record does not match its entity');
  return value.data;
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function cursor(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new SyncRejection('INVALID_CURSOR', 'Sync cursor is invalid');
  }
}

function serializeAccount(record: {
  id: string; label: string; type: MobileAccount['type']; institution: string | null; currency: string;
  startingBalance: Prisma.Decimal; color: string | null; icon: string | null; isArchived: boolean; updatedAt: Date;
}): MobileAccount {
  return {
    id: record.id, label: record.label, type: record.type, institution: record.institution,
    currency: record.currency, startingBalance: String(record.startingBalance), color: record.color,
    icon: record.icon, isArchived: record.isArchived, updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeCategory(record: {
  id: string; name: string; type: MobileCategory['type']; parentId: string | null; icon: string | null;
  color: string | null; bucket: MobileCategory['bucket']; updatedAt: Date;
}): MobileCategory {
  return {
    id: record.id, name: record.name, type: record.type, parentId: record.parentId,
    icon: record.icon, color: record.color, bucket: record.bucket, updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeTransaction(
  source: {
    id: string; accountId: string; categoryId: string | null; bucket: MobileTransaction['bucket']; amount: Prisma.Decimal;
    type: MobileTransaction['type']; date: Date; note: string | null; updatedAt: Date;
  },
  destinationAccountId: string | null,
): MobileTransaction {
  return {
    id: source.id, accountId: source.accountId, categoryId: source.categoryId, bucket: source.bucket,
    amount: String(source.amount), type: source.type, destinationAccountId,
    date: source.date.toISOString().slice(0, 10), note: source.note, updatedAt: source.updatedAt.toISOString(),
  };
}

async function appendChange(
  tx: Tx,
  userId: string,
  entity: Entity,
  recordId: string,
  operation: 'upsert' | 'delete',
  record: MobileAccount | MobileCategory | MobileTransaction | null,
) {
  return tx.mobileSyncChange.create({
    data: { userId, entity, recordId, operation, data: record === null ? Prisma.JsonNull : json(record) },
  });
}

async function tombstoneAfter(tx: Tx, userId: string, entity: Entity, recordId: string, baseCursor: string | null) {
  const found = await tx.mobileSyncChange.findFirst({
    where: {
      userId, entity, recordId, operation: 'delete',
      ...(baseCursor === null ? {} : { cursor: { gt: cursor(baseCursor) } }),
    },
    select: { cursor: true },
  });
  return Boolean(found);
}

async function ownedAccount(tx: Tx, userId: string, accountId: string) {
  return tx.account.findFirst({ where: { id: accountId, userId }, select: { id: true, currency: true } });
}

async function applyAccountUpsert(tx: Tx, userId: string, mutation: Extract<MobileSyncMutation, { operation: 'upsert' }>) {
  const record = requireRecord(mobileAccountSchema.safeParse(mutation.record));
  if (record.id !== mutation.recordId) throw new SyncRejection('INVALID_MUTATION', 'Record ID does not match mutation');
  if (await tombstoneAfter(tx, userId, 'account', record.id, mutation.baseCursor)) {
    throw new SyncRejection('TOMBSTONED', 'This account was deleted on another device; create a new account instead');
  }
  const existing = await tx.account.findUnique({ where: { id: record.id }, select: { id: true, userId: true } });
  isOwned(existing, userId);
  const data = {
    label: record.label, type: record.type, institution: record.institution, currency: record.currency,
    startingBalance: record.startingBalance, color: record.color, icon: record.icon, isArchived: record.isArchived,
  };
  const saved = existing
    ? await tx.account.update({ where: { id: record.id }, data })
    : await tx.account.create({ data: { id: record.id, userId, ...data } });
  const serialized = serializeAccount(saved);
  await appendChange(tx, userId, 'account', saved.id, 'upsert', serialized);
  return serialized;
}

async function applyCategoryUpsert(tx: Tx, userId: string, mutation: Extract<MobileSyncMutation, { operation: 'upsert' }>) {
  const record = requireRecord(mobileCategorySchema.safeParse(mutation.record));
  if (record.id !== mutation.recordId) throw new SyncRejection('INVALID_MUTATION', 'Record ID does not match mutation');
  if (await tombstoneAfter(tx, userId, 'category', record.id, mutation.baseCursor)) {
    throw new SyncRejection('TOMBSTONED', 'This category was deleted on another device; create a new category instead');
  }
  if (record.parentId) {
    const parent = await tx.category.findFirst({ where: { id: record.parentId, userId }, select: { type: true } });
    if (!parent || parent.type !== record.type) throw new SyncRejection('INVALID_PARENT', 'Category parent is unavailable or has another type');
  }
  const existing = await tx.category.findUnique({ where: { id: record.id }, select: { id: true, userId: true } });
  isOwned(existing, userId);
  const data = { name: record.name, type: record.type, parentId: record.parentId, icon: record.icon, color: record.color, bucket: record.bucket };
  const saved = existing
    ? await tx.category.update({ where: { id: record.id }, data })
    : await tx.category.create({ data: { id: record.id, userId, ...data } });
  const serialized = serializeCategory(saved);
  await appendChange(tx, userId, 'category', saved.id, 'upsert', serialized);
  return serialized;
}

async function applyTransactionUpsert(tx: Tx, userId: string, mutation: Extract<MobileSyncMutation, { operation: 'upsert' }>) {
  const record = requireRecord(mobileTransactionSchema.safeParse(mutation.record));
  if (record.id !== mutation.recordId) throw new SyncRejection('INVALID_MUTATION', 'Record ID does not match mutation');
  if (await tombstoneAfter(tx, userId, 'transaction', record.id, mutation.baseCursor)) {
    throw new SyncRejection('TOMBSTONED', 'This transaction was deleted on another device; create a new transaction instead');
  }
  const existing = await tx.transaction.findUnique({ where: { id: record.id }, select: { id: true, userId: true, accountId: true, transferGroupId: true, transferRole: true } });
  isOwned(existing, userId);
  const accountIds = [record.accountId, ...(record.destinationAccountId ? [record.destinationAccountId] : []), ...(existing ? [existing.accountId] : [])];
  const accounts = await lockAccountsInOrder(tx, accountIds, userId);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const source = accountById.get(record.accountId);
  if (!source) throw new SyncRejection('ACCOUNT_NOT_FOUND', 'Transaction account was not found');
  if (record.categoryId) {
    const category = await tx.category.findFirst({ where: { id: record.categoryId, userId }, select: { id: true } });
    if (!category) throw new SyncRejection('CATEGORY_NOT_FOUND', 'Transaction category was not found');
  }

  if (record.type !== 'transfer') {
    const data = { accountId: record.accountId, categoryId: record.categoryId, bucket: record.bucket, amount: record.amount, type: record.type, transferGroupId: null, transferRole: null, date: date(record.date), note: record.note };
    const saved = existing
      ? await tx.transaction.update({ where: { id: record.id }, data })
      : await tx.transaction.create({ data: { id: record.id, userId, source: 'manual', ...data } });
    if (existing?.transferGroupId) {
      await tx.transaction.deleteMany({ where: { transferGroupId: existing.transferGroupId, id: { not: saved.id }, userId } });
    }
    const serialized = serializeTransaction(saved, null);
    await appendChange(tx, userId, 'transaction', saved.id, 'upsert', serialized);
    return serialized;
  }

  const destination = record.destinationAccountId ? accountById.get(record.destinationAccountId) : null;
  if (!destination) throw new SyncRejection('ACCOUNT_NOT_FOUND', 'Transfer destination account was not found');
  if (source.currency.toUpperCase() !== destination.currency.toUpperCase()) throw new SyncRejection('CURRENCY_MISMATCH', 'Transfers require accounts with the same currency');
  if (existing?.transferRole === 'incoming') throw new SyncRejection('INVALID_TRANSFER_ID', 'Transfers must retain their outgoing record ID');

  const data = { amount: record.amount, date: date(record.date), note: record.note };
  let outgoing;
  let incoming;
  if (existing?.transferGroupId) {
    outgoing = await tx.transaction.update({
      where: { id: record.id },
      data: { ...data, accountId: record.accountId, categoryId: null, bucket: null, type: 'transfer', transferRole: 'outgoing' },
    });
    const currentIncoming = await tx.transaction.findFirst({ where: { transferGroupId: existing.transferGroupId, transferRole: 'incoming', userId } });
    incoming = currentIncoming
      ? await tx.transaction.update({ where: { id: currentIncoming.id }, data: { ...data, accountId: record.destinationAccountId!, categoryId: null, bucket: null, type: 'transfer', transferRole: 'incoming' } })
      : await tx.transaction.create({ data: { userId, accountId: record.destinationAccountId!, categoryId: null, bucket: null, type: 'transfer', transferGroupId: existing.transferGroupId, transferRole: 'incoming', source: 'manual', ...data } });
  } else {
    const transferGroupId = randomUUID();
    outgoing = existing
      ? await tx.transaction.update({ where: { id: record.id }, data: { ...data, accountId: record.accountId, categoryId: null, bucket: null, type: 'transfer', transferGroupId, transferRole: 'outgoing' } })
      : await tx.transaction.create({ data: { id: record.id, userId, accountId: record.accountId, categoryId: null, bucket: null, type: 'transfer', transferGroupId, transferRole: 'outgoing', source: 'manual', ...data } });
    incoming = await tx.transaction.create({ data: { userId, accountId: record.destinationAccountId!, categoryId: null, bucket: null, type: 'transfer', transferGroupId, transferRole: 'incoming', source: 'manual', ...data } });
  }
  const serialized = serializeTransaction(outgoing, incoming.accountId);
  await appendChange(tx, userId, 'transaction', outgoing.id, 'upsert', serialized);
  return serialized;
}

async function deleteAccount(tx: Tx, userId: string, recordId: string) {
  const account = await tx.account.findUnique({ where: { id: recordId }, select: { id: true, userId: true } });
  isOwned(account, userId);
  if (!account) return;
  const directRows = await tx.transaction.findMany({ where: { accountId: recordId, userId }, select: { id: true, transferGroupId: true, transferRole: true } });
  const groups = directRows.flatMap((row) => (row.transferGroupId ? [row.transferGroupId] : []));
  const rows = await tx.transaction.findMany({ where: { userId, OR: [{ accountId: recordId }, ...(groups.length ? [{ transferGroupId: { in: groups } }] : [])] }, select: { id: true, transferGroupId: true, transferRole: true } });
  const logicalIds = new Set(rows.filter((row) => !row.transferGroupId || row.transferRole === 'outgoing').map((row) => row.id));
  await tx.transaction.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await tx.recurringRule.deleteMany({ where: { accountId: recordId, userId } });
  await tx.account.delete({ where: { id: recordId } });
  for (const id of logicalIds) await appendChange(tx, userId, 'transaction', id, 'delete', null);
  await appendChange(tx, userId, 'account', recordId, 'delete', null);
}

async function deleteCategory(tx: Tx, userId: string, recordId: string) {
  const category = await tx.category.findUnique({ where: { id: recordId }, select: { id: true, userId: true } });
  isOwned(category, userId);
  if (!category) return;
  const children = await tx.category.findMany({ where: { userId, parentId: recordId } });
  const transactions = await tx.transaction.findMany({ where: { userId, categoryId: recordId } });
  for (const child of children) {
    const updated = await tx.category.update({ where: { id: child.id }, data: { parentId: null } });
    await appendChange(tx, userId, 'category', updated.id, 'upsert', serializeCategory(updated));
  }
  for (const transaction of transactions) {
    const updated = await tx.transaction.update({ where: { id: transaction.id }, data: { categoryId: null, bucket: null } });
    await appendChange(tx, userId, 'transaction', updated.id, 'upsert', serializeTransaction(updated, null));
  }
  await tx.category.delete({ where: { id: recordId } });
  await appendChange(tx, userId, 'category', recordId, 'delete', null);
}

async function deleteTransaction(tx: Tx, userId: string, recordId: string) {
  const current = await tx.transaction.findUnique({ where: { id: recordId }, select: { id: true, userId: true, transferGroupId: true } });
  isOwned(current, userId);
  if (!current) return;
  const rows = current.transferGroupId
    ? await tx.transaction.findMany({ where: { userId, transferGroupId: current.transferGroupId }, select: { id: true, transferRole: true } })
    : [{ id: current.id, transferRole: null }];
  const logicalId = rows.find((row) => row.transferRole === 'outgoing')?.id ?? current.id;
  await tx.transaction.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await appendChange(tx, userId, 'transaction', logicalId, 'delete', null);
}

async function applyDelete(tx: Tx, userId: string, mutation: Extract<MobileSyncMutation, { operation: 'delete' }>) {
  if (mutation.entity === 'account') await deleteAccount(tx, userId, mutation.recordId);
  if (mutation.entity === 'category') await deleteCategory(tx, userId, mutation.recordId);
  if (mutation.entity === 'transaction') await deleteTransaction(tx, userId, mutation.recordId);
}

async function applyMutation(tx: Tx, userId: string, mutation: MobileSyncMutation): Promise<MutationResult> {
  if (mutation.operation === 'delete') {
    await applyDelete(tx, userId, mutation);
    return { mutationId: mutation.mutationId, status: 'accepted', entity: mutation.entity, recordId: mutation.recordId, operation: 'delete' };
  }
  const record = mutation.entity === 'account'
    ? await applyAccountUpsert(tx, userId, mutation)
    : mutation.entity === 'category'
      ? await applyCategoryUpsert(tx, userId, mutation)
      : await applyTransactionUpsert(tx, userId, mutation);
  return { mutationId: mutation.mutationId, status: 'accepted', entity: mutation.entity, recordId: mutation.recordId, operation: 'upsert', record };
}

export async function processMobileMutation(userId: string, mutation: MobileSyncMutation): Promise<MutationResult> {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.mobileMutation.findUnique({ where: { userId_clientMutationId: { userId, clientMutationId: mutation.mutationId } } });
    if (receipt) return receipt.result as unknown as MutationResult;
    let result: MutationResult;
    try {
      result = await applyMutation(tx, userId, mutation);
    } catch (error) {
      if (!(error instanceof SyncRejection)) throw error;
      result = { mutationId: mutation.mutationId, status: 'rejected', code: error.code, message: error.message };
    }
    await tx.mobileMutation.create({ data: { userId, clientMutationId: mutation.mutationId, result: json(result) } });
    return result;
  });
}

export async function pullMobileChanges(userId: string, afterCursor: string): Promise<{ cursor: string; changes: MobileSyncChange[]; hasMore: boolean }> {
  const after = cursor(afterCursor);
  const rows = await prisma.mobileSyncChange.findMany({
    where: { userId, cursor: { gt: after } }, orderBy: { cursor: 'asc' }, take: 501,
  });
  const hasMore = rows.length > 500;
  const visible = rows.slice(0, 500);
  const latest = visible.at(-1)?.cursor ?? after;
  return {
    cursor: latest.toString(),
    hasMore,
    changes: visible.map((row) => ({
      cursor: row.cursor.toString(), entity: row.entity as Entity, recordId: row.recordId,
      operation: row.operation as 'upsert' | 'delete',
      record: row.operation === 'delete' ? null : (row.data as unknown as MobileAccount | MobileCategory | MobileTransaction),
    })),
  };
}

/**
 * Compatibility bridge for browser Route Handlers. New mobile mutations append
 * their change in their own domain transaction above; legacy web mutations call
 * this immediately after success so existing browser edits also converge.
 */
export async function recordCanonicalMobileUpsert(userId: string, entity: Entity, recordId: string) {
  await prisma.$transaction(async (tx) => {
    if (entity === 'account') {
      const record = await tx.account.findFirst({ where: { id: recordId, userId } });
      if (record) await appendChange(tx, userId, entity, record.id, 'upsert', serializeAccount(record));
      return;
    }
    if (entity === 'category') {
      const record = await tx.category.findFirst({ where: { id: recordId, userId } });
      if (record) await appendChange(tx, userId, entity, record.id, 'upsert', serializeCategory(record));
      return;
    }
    const source = await tx.transaction.findFirst({ where: { id: recordId, userId } });
    if (!source) return;
    const group = source.transferGroupId
      ? await tx.transaction.findMany({ where: { userId, transferGroupId: source.transferGroupId } })
      : [source];
    const outgoing = group.find((record) => record.transferRole === 'outgoing') ?? source;
    const incoming = group.find((record) => record.transferRole === 'incoming');
    await appendChange(tx, userId, entity, outgoing.id, 'upsert', serializeTransaction(outgoing, incoming?.accountId ?? null));
  });
}

export async function recordCanonicalMobileTombstone(userId: string, entity: Entity, recordId: string) {
  await prisma.mobileSyncChange.create({ data: { userId, entity, recordId, operation: 'delete', data: Prisma.JsonNull } });
}
