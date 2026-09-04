import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { MobileAccount, MobileCategory, MobileSyncChange, MobileSyncMutation, MobileTransaction } from '@faura-farmer/types';

type Entity = 'account' | 'category' | 'transaction';
type RecordFor<E extends Entity> = E extends 'account' ? MobileAccount : E extends 'category' ? MobileCategory : MobileTransaction;
type LocalRecord = MobileAccount | MobileCategory | MobileTransaction;

const databasePromise = SQLite.openDatabaseAsync('faura-farmer.db');
const tableByEntity: Record<Entity, string> = { account: 'accounts', category: 'categories', transaction: 'transactions' };

export async function initializeDatabase() {
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS outbox (
      mutation_id TEXT PRIMARY KEY NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL,
      operation TEXT NOT NULL, base_cursor TEXT, payload TEXT, created_at TEXT NOT NULL, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS outbox_created_at_idx ON outbox(created_at);
  `);
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
  await db.runAsync('INSERT OR REPLACE INTO profile (id, email, name, updated_at) VALUES (?, ?, ?, ?)', [profile.id, profile.email, profile.name, new Date().toISOString()]);
}

export async function getProfile() {
  const db = await database();
  return db.getFirstAsync<{ id: string; email: string; name: string | null }>('SELECT id, email, name FROM profile LIMIT 1');
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
  });
}

export async function clearLocalData() {
  const db = await database();
  await db.execAsync('DELETE FROM profile; DELETE FROM metadata; DELETE FROM accounts; DELETE FROM categories; DELETE FROM transactions; DELETE FROM outbox;');
}
