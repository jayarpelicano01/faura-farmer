import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { MobileAccount, MobileBudget, MobileCategory, MobileMonthlyBudget, MobileProfile, MobileSyncChange, MobileSyncMutation, MobileTransaction } from '@faura-farmer/types';

type Entity = 'account' | 'category' | 'transaction' | 'budget' | 'monthly_budget';
type RecordFor<E extends Entity> = E extends 'account' ? MobileAccount : E extends 'category' ? MobileCategory : E extends 'transaction' ? MobileTransaction : E extends 'budget' ? MobileBudget : MobileMonthlyBudget;
type LocalRecord = MobileAccount | MobileCategory | MobileTransaction | MobileBudget | MobileMonthlyBudget;

export type TransactionPageCursor = {
  updatedAt: string;
  id: string;
};

export type TransactionPage = {
  items: MobileTransaction[];
  nextCursor: TransactionPageCursor | null;
};

const databasePromise = SQLite.openDatabaseAsync('faura-farmer.db');
const tableByEntity: Record<Entity, string> = { account: 'accounts', category: 'categories', transaction: 'transactions', budget: 'budgets', monthly_budget: 'monthly_budgets' };
let initializationPromise: Promise<void> | null = null;

export async function initializeDatabase() {
  initializationPromise ??= initializeDatabaseOnce();
  return initializationPromise;
}

async function initializeDatabaseOnce() {
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT, username TEXT, has_password INTEGER, display_currency TEXT NOT NULL DEFAULT 'PHP', usd_per_php TEXT, rate_date TEXT, rate_refreshed_at TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS monthly_budgets (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS outbox (
      mutation_id TEXT PRIMARY KEY NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL,
      operation TEXT NOT NULL, base_cursor TEXT, payload TEXT, created_at TEXT NOT NULL, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS outbox_created_at_idx ON outbox(created_at);
    CREATE INDEX IF NOT EXISTS transactions_active_updated_at_idx ON transactions(deleted_at, updated_at DESC, id DESC);
  `);

  const profileColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(profile)');
  const names = new Set(profileColumns.map((column) => column.name));
  if (!names.has('username')) await db.execAsync('ALTER TABLE profile ADD COLUMN username TEXT');
  if (!names.has('has_password')) await db.execAsync('ALTER TABLE profile ADD COLUMN has_password INTEGER');
  if (!names.has('display_currency')) await db.execAsync("ALTER TABLE profile ADD COLUMN display_currency TEXT NOT NULL DEFAULT 'PHP'");
  if (!names.has('usd_per_php')) await db.execAsync('ALTER TABLE profile ADD COLUMN usd_per_php TEXT');
  if (!names.has('rate_date')) await db.execAsync('ALTER TABLE profile ADD COLUMN rate_date TEXT');
  if (!names.has('rate_refreshed_at')) await db.execAsync('ALTER TABLE profile ADD COLUMN rate_refreshed_at TEXT');
}

async function database() {
  await initializeDatabase();
  return databasePromise;
}

export async function getCursor() {
  const db = await database();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['sync_cursor']))?.value ?? '0';
}

async function setCursor(db: SQLite.SQLiteDatabase, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['sync_cursor', value]);
}

export async function saveProfile(profile: { id: string; email: string; name: string | null }) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO profile (id, email, name, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, updated_at = excluded.updated_at`,
    [profile.id, profile.email, profile.name, new Date().toISOString()],
  );
}

export async function getLastSyncedAt() {
  const db = await database();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['last_synced_at']))?.value ?? null;
}

export async function getProfile() {
  const db = await database();
  return db.getFirstAsync<{ id: string; email: string; name: string | null }>('SELECT id, email, name FROM profile LIMIT 1');
}

export async function saveProfileDetails(profile: MobileProfile) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO profile (id, email, name, username, has_password, display_currency, usd_per_php, rate_date, rate_refreshed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       username = excluded.username,
       has_password = excluded.has_password,
       display_currency = excluded.display_currency,
       usd_per_php = excluded.usd_per_php,
       rate_date = excluded.rate_date,
       rate_refreshed_at = excluded.rate_refreshed_at,
       updated_at = excluded.updated_at`,
    [profile.id, profile.email, profile.name, profile.username, profile.hasPassword ? 1 : 0, profile.displayCurrency, profile.usdPerPhp, profile.rateDate, profile.rateRefreshedAt, new Date().toISOString()],
  );
}

export async function getProfileDetails() {
  const db = await database();
  const profile = await db.getFirstAsync<{
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    has_password: number | null;
    display_currency: 'PHP' | 'USD' | null;
    usd_per_php: string | null;
    rate_date: string | null;
    rate_refreshed_at: string | null;
  }>('SELECT id, email, name, username, has_password FROM profile LIMIT 1');
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    username: profile.username,
    hasPassword: profile.has_password === 1,
    displayCurrency: profile.display_currency === 'USD' ? 'USD' : 'PHP',
    usdPerPhp: profile.usd_per_php,
    rateDate: profile.rate_date,
    rateRefreshedAt: profile.rate_refreshed_at,
  } satisfies MobileProfile;
}

function idFor(record: LocalRecord) {
  return record.id;
}

function table(entity: Entity) {
  return tableByEntity[entity];
}

async function upsertRecord(db: SQLite.SQLiteDatabase, entity: Entity, record: LocalRecord) {
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table(entity)} (id, data, updated_at, deleted_at) VALUES (?, ?, ?, NULL)`,
    [idFor(record), JSON.stringify(record), record.updatedAt],
  );
}

export async function listRecords<E extends Entity>(entity: E): Promise<RecordFor<E>[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table(entity)} WHERE deleted_at IS NULL ORDER BY updated_at DESC`);
  return rows.map((row) => JSON.parse(row.data) as RecordFor<E>);
}

/**
 * Reads a stable window from the local, offline transaction cache. The cursor uses
 * the same newest-first order as the previous full-list query, so a transaction
 * cannot appear twice while the user loads another page.
 */
export async function listTransactionPage({
  cursor,
  limit = 20,
}: {
  cursor?: TransactionPageCursor | null;
  limit?: number;
} = {}): Promise<TransactionPage> {
  const db = await database();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const cursorClause = cursor
    ? ' AND (updated_at < ? OR (updated_at = ? AND id < ?))'
    : '';
  const parameters = cursor
    ? [cursor.updatedAt, cursor.updatedAt, cursor.id, safeLimit + 1]
    : [safeLimit + 1];
  const rows = await db.getAllAsync<{ id: string; data: string; updated_at: string }>(
    `SELECT id, data, updated_at
     FROM transactions
     WHERE deleted_at IS NULL${cursorClause}
     ORDER BY updated_at DESC, id DESC
     LIMIT ?`,
    parameters,
  );
  const visible = rows.slice(0, safeLimit);
  const last = visible.at(-1);

  return {
    items: visible.map((row) => JSON.parse(row.data) as MobileTransaction),
    nextCursor: rows.length > safeLimit && last
      ? { updatedAt: last.updated_at, id: last.id }
      : null,
  };
}

export async function queueUpsert<E extends Entity>(entity: E, record: RecordFor<E>) {
  const db = await database();
  const currentCursor = await getCursor();
  const mutation: MobileSyncMutation = {
    mutationId: Crypto.randomUUID(), entity, recordId: record.id, operation: 'upsert', baseCursor: currentCursor, record,
  } as MobileSyncMutation;
  await db.withTransactionAsync(async () => {
    await upsertRecord(db, entity, record);
    await db.runAsync(
      'INSERT INTO outbox (mutation_id, entity, record_id, operation, base_cursor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mutation.mutationId, entity, record.id, 'upsert', currentCursor, JSON.stringify(mutation), new Date().toISOString()],
    );
  });
}

export async function queueDelete(entity: Entity, recordId: string) {
  const db = await database();
  const currentCursor = await getCursor();
  const mutation: MobileSyncMutation = { mutationId: Crypto.randomUUID(), entity, recordId, operation: 'delete', baseCursor: currentCursor };
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE ${table(entity)} SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), recordId]);
    await db.runAsync(
      'INSERT INTO outbox (mutation_id, entity, record_id, operation, base_cursor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mutation.mutationId, entity, recordId, 'delete', currentCursor, JSON.stringify(mutation), new Date().toISOString()],
    );
  });
}

export async function outboxBatch(limit = 100): Promise<MobileSyncMutation[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox ORDER BY created_at ASC LIMIT ?', [limit]);
  return rows.map((row) => JSON.parse(row.payload) as MobileSyncMutation);
}

export async function resolveOutbox(results: Array<{ mutationId: string; status: 'accepted' | 'rejected'; message?: string }>) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const result of results) {
      // Rejections are acknowledged so the queue can converge; surface the last
      // reason to the UI instead of endlessly retrying a tombstoned mutation.
      await db.runAsync('DELETE FROM outbox WHERE mutation_id = ?', [result.mutationId]);
      if (result.status === 'rejected') {
        await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['last_sync_error', result.message ?? 'A change could not be synchronized']);
      }
    }
  });
}

export async function takeLastSyncError() {
  const db = await database();
  const value = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['last_sync_error']);
  if (value) await db.runAsync('DELETE FROM metadata WHERE key = ?', ['last_sync_error']);
  return value?.value ?? null;
}

export async function reconcileChanges(changes: MobileSyncChange[], nextCursor: string) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const change of changes) {
      const entity = change.entity as Entity;
      if (change.operation === 'delete') {
        await db.runAsync(`UPDATE ${table(entity)} SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), change.recordId]);
      } else if (change.record) {
        await upsertRecord(db, entity, change.record);
      }
    }
    await setCursor(db, nextCursor);
    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['last_synced_at', new Date().toISOString()]);
  });
}

export async function clearLocalData() {
  const db = await database();
  await db.execAsync('DELETE FROM profile; DELETE FROM metadata; DELETE FROM accounts; DELETE FROM categories; DELETE FROM transactions; DELETE FROM budgets; DELETE FROM monthly_budgets; DELETE FROM outbox;');
}
