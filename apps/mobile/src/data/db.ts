import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { emptyBackupEntityCounts, type BackupDocument, type BackupEntityCounts, type BackupRestorePreview, type BackupRestoreResult, type MobileAccount, type MobileBudget, type MobileCategory, type MobileDebt, type MobileDebtAdjustment, type MobileDebtCashEvent, type MobileDebtPayment, type MobileMonthlyBudget, type MobilePerson, type MobileProfile, type MobileRecurringRule, type MobileSyncChange, type MobileSyncMutation, type MobileTransaction } from '@faura-farmer/types';
import { localRestoreRecords, planLocalBackupRestore, type LocalBackupRestoreRecords } from '@/backup/restore';

export type Entity = 'account' | 'category' | 'transaction' | 'budget' | 'monthly_budget' | 'recurring_rule' | 'person' | 'debt' | 'debt_adjustment' | 'debt_payment' | 'debt_cash_event';
type RecordFor<E extends Entity> = E extends 'account' ? MobileAccount : E extends 'category' ? MobileCategory : E extends 'transaction' ? MobileTransaction : E extends 'budget' ? MobileBudget : E extends 'monthly_budget' ? MobileMonthlyBudget : E extends 'recurring_rule' ? MobileRecurringRule : E extends 'person' ? MobilePerson : E extends 'debt' ? MobileDebt : E extends 'debt_adjustment' ? MobileDebtAdjustment : E extends 'debt_payment' ? MobileDebtPayment : MobileDebtCashEvent;
type LocalRecord = MobileAccount | MobileCategory | MobileTransaction | MobileBudget | MobileMonthlyBudget | MobileRecurringRule | MobilePerson | MobileDebt | MobileDebtAdjustment | MobileDebtPayment | MobileDebtCashEvent;

export type LocalBackupSnapshot = {
  profile: MobileProfile | null;
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
  mutations: MobileSyncMutation[];
  latestPendingChangeAt: string | null;
};

export type PendingBackupRestoreStage = 'preview-ready' | 'account-restored';

export type PendingBackupRestore = {
  backupId: string;
  entityCounts: BackupEntityCounts;
  file: string;
  preview: BackupRestorePreview;
  savedAt: string;
  workspace: 'local' | 'online';
  stage: PendingBackupRestoreStage;
  restoredNotice?: string;
  successNotice?: string;
};

export type TransactionPageCursor = {
  updatedAt: string;
  id: string;
};

export type TransactionPage = {
  items: MobileTransaction[];
  nextCursor: TransactionPageCursor | null;
};

const tableByEntity: Record<Entity, string> = { account: 'accounts', category: 'categories', transaction: 'transactions', budget: 'budgets', monthly_budget: 'monthly_budgets', recurring_rule: 'recurring_rules', person: 'persons', debt: 'debts', debt_adjustment: 'debt_adjustments', debt_payment: 'debt_payments', debt_cash_event: 'debt_cash_events' };

export type DatabaseHandle = {
  initializeDatabase: () => Promise<void>;
  getCursor: () => Promise<string>;
  saveProfile: (profile: { id: string; email: string; name: string | null }) => Promise<void>;
  getProfile: () => Promise<{ id: string; email: string; name: string | null } | null>;
  saveProfileDetails: (profile: MobileProfile) => Promise<void>;
  getProfileDetails: () => Promise<MobileProfile | null>;
  getLastSyncedAt: () => Promise<string | null>;
  getPendingSyncCount: () => Promise<number>;
  getBackupSnapshot: () => Promise<LocalBackupSnapshot>;
  savePendingBackupRestore: (restore: PendingBackupRestore) => Promise<void>;
  getPendingBackupRestore: () => Promise<PendingBackupRestore | null>;
  clearPendingBackupRestore: () => Promise<void>;
  previewBackupRestore: (document: BackupDocument) => Promise<BackupRestorePreview>;
  restoreBackup: (document: BackupDocument) => Promise<BackupRestoreResult>;
  listRecords: <E extends Entity>(entity: E) => Promise<RecordFor<E>[]>;
  listTransactionPage: (args?: { cursor?: TransactionPageCursor | null; limit?: number }) => Promise<TransactionPage>;
  queueUpsert: <E extends Entity>(entity: E, record: RecordFor<E>) => Promise<void>;
  queueDelete: (entity: Entity, recordId: string) => Promise<void>;
  queueRecurringOccurrence: (args: { action: 'approve' | 'skip'; expectedDueDate: string; rule: MobileRecurringRule; transaction?: MobileTransaction }) => Promise<void>;
  upsertLocal: <E extends Entity>(entity: E, record: RecordFor<E>) => Promise<void>;
  deleteLocal: (entity: Entity, recordId: string) => Promise<void>;
  hardDeleteLocal: (entity: Entity, recordId: string) => Promise<void>;
  outboxBatch: (limit?: number) => Promise<MobileSyncMutation[]>;
  resolveOutbox: (results: Array<{ mutationId: string; status: 'accepted' | 'rejected'; message?: string }>) => Promise<void>;
  takeLastSyncError: () => Promise<string | null>;
  reconcileChanges: (changes: MobileSyncChange[], nextCursor: string) => Promise<void>;
  clearLocalData: () => Promise<void>;
};

export function createDatabase(name: string): DatabaseHandle {
  const databasePromise = SQLite.openDatabaseAsync(name);
  let initializationPromise: Promise<void> | null = null;

  async function initializeDatabase() {
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
      CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS persons (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS debts (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS debt_adjustments (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS debt_payments (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS debt_cash_events (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
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

    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        UPDATE categories
        SET data = json_remove(data, '$.parentId')
        WHERE json_valid(data);

        UPDATE outbox
        SET payload = json_remove(payload, '$.record.parentId')
        WHERE entity = 'category'
          AND operation = 'upsert'
          AND payload IS NOT NULL
          AND json_valid(payload);
      `);
    });
  }

  async function database() {
    await initializeDatabase();
    return databasePromise;
  }

  async function getCursor() {
    const db = await database();
    return (await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['sync_cursor']))?.value ?? '0';
  }

  async function setCursor(db: SQLite.SQLiteDatabase, value: string) {
    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['sync_cursor', value]);
  }

  async function saveProfile(profile: { id: string; email: string; name: string | null }) {
    const db = await database();
    await db.runAsync(
      `INSERT INTO profile (id, email, name, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, updated_at = excluded.updated_at`,
      [profile.id, profile.email, profile.name, new Date().toISOString()],
    );
  }

  async function getLastSyncedAt() {
    const db = await database();
    return (await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['last_synced_at']))?.value ?? null;
  }

  async function getProfile() {
    const db = await database();
    return db.getFirstAsync<{ id: string; email: string; name: string | null }>('SELECT id, email, name FROM profile LIMIT 1');
  }

  async function saveProfileDetails(profile: MobileProfile) {
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

  async function getProfileDetails() {
    const db = await database();
    return getProfileDetailsFrom(db);
  }

  async function getProfileDetailsFrom(db: SQLite.SQLiteDatabase) {
    const profile = await db.getFirstAsync<{
      id: string;
      email: string;
      name: string | null;
      username: string | null;
      has_password: number | null;
      display_currency: 'PHP' | 'USD' | null;
      usd_per_php: string | number | null;
      rate_date: string | null;
      rate_refreshed_at: string | null;
    }>('SELECT id, email, name, username, has_password, display_currency, usd_per_php, rate_date, rate_refreshed_at FROM profile LIMIT 1');
    if (!profile) return null;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      username: profile.username,
      hasPassword: profile.has_password === 1,
      displayCurrency: profile.display_currency === 'USD' ? 'USD' : 'PHP',
      usdPerPhp: profile.usd_per_php === null ? null : String(profile.usd_per_php),
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

  async function listRecords<E extends Entity>(entity: E): Promise<RecordFor<E>[]> {
    const db = await database();
    return listRecordsFrom(db, entity);
  }

  async function listRecordsFrom<E extends Entity>(db: SQLite.SQLiteDatabase, entity: E): Promise<RecordFor<E>[]> {
    const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table(entity)} WHERE deleted_at IS NULL ORDER BY updated_at DESC`);
    return rows.map((row) => JSON.parse(row.data) as RecordFor<E>);
  }

  async function listBackupRestoreRecordsFrom(db: SQLite.SQLiteDatabase): Promise<LocalBackupRestoreRecords> {
    const all = async <E extends Entity>(entity: E) => {
      const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM ${table(entity)}`);
      return rows.map((row) => JSON.parse(row.data) as RecordFor<E>);
    };
    const [accounts, categories, transactions, budgets, monthlyBudgets, recurringRules, persons, debts, debtAdjustments, debtPayments, debtCashEvents] = await Promise.all([
      all('account'),
      all('category'),
      all('transaction'),
      all('budget'),
      all('monthly_budget'),
      all('recurring_rule'),
      all('person'),
      all('debt'),
      all('debt_adjustment'),
      all('debt_payment'),
      all('debt_cash_event'),
    ]);
    return { accounts, categories, transactions, budgets, monthlyBudgets, recurringRules, persons, debts, debtAdjustments, debtPayments, debtCashEvents };
  }

  async function previewBackupRestore(document: BackupDocument) {
    const db = await database();
    let preview: BackupRestorePreview | null = null;
    await db.withTransactionAsync(async () => {
      preview = planLocalBackupRestore(document, await listBackupRestoreRecordsFrom(db));
    });
    if (!preview) throw new Error('Unable to preview this backup.');
    return preview;
  }

  async function restoreBackup(document: BackupDocument): Promise<BackupRestoreResult> {
    const db = await database();
    let result: BackupRestoreResult | null = null;
    await db.withTransactionAsync(async () => {
      const [profile, existing] = await Promise.all([
        getProfileDetailsFrom(db),
        listBackupRestoreRecordsFrom(db),
      ]);
      if (!profile) throw new Error('Create a local workspace before restoring a backup.');

      const plan = planLocalBackupRestore(document, existing);
      if (!plan.canRestore) {
        result = { ...plan, added: emptyBackupEntityCounts() };
        return;
      }

      const records = localRestoreRecords(document, profile.id);
      const present = {
        accounts: new Set(existing.accounts.map((record) => record.id)),
        categories: new Set(existing.categories.map((record) => record.id)),
        transactions: new Set(existing.transactions.map((record) => record.id)),
        budgets: new Set(existing.budgets.map((record) => record.id)),
        monthlyBudgets: new Set(existing.monthlyBudgets.map((record) => record.id)),
        recurringRules: new Set(existing.recurringRules.map((record) => record.id)),
        persons: new Set(existing.persons.map((record) => record.id)),
        debts: new Set(existing.debts.map((record) => record.id)),
        debtAdjustments: new Set(existing.debtAdjustments.map((record) => record.id)),
        debtPayments: new Set(existing.debtPayments.map((record) => record.id)),
        debtCashEvents: new Set(existing.debtCashEvents.map((record) => record.id)),
      };
      const added = emptyBackupEntityCounts();
      const add = async <E extends Entity>(entity: E, key: keyof typeof present, rows: RecordFor<E>[]) => {
        for (const record of rows) {
          if (present[key].has(record.id)) continue;
          await upsertRecord(db, entity, record);
          present[key].add(record.id);
          const countKey = key as keyof BackupEntityCounts;
          added[countKey] += 1;
        }
      };

      // Dependencies are inserted first. This path intentionally does not touch profile, metadata, or outbox rows.
      await add('account', 'accounts', records.accounts);
      await add('category', 'categories', records.categories);
      await add('recurring_rule', 'recurringRules', records.recurringRules);
      await add('transaction', 'transactions', records.transactions);
      await add('budget', 'budgets', records.budgets);
      await add('monthly_budget', 'monthlyBudgets', records.monthlyBudgets);
      await add('person', 'persons', records.persons);
      await add('debt', 'debts', records.debts);
      await add('debt_adjustment', 'debtAdjustments', records.debtAdjustments);
      await add('debt_payment', 'debtPayments', records.debtPayments);
      await add('debt_cash_event', 'debtCashEvents', records.debtCashEvents);
      result = { ...plan, added };
    });
    if (!result) throw new Error('Unable to restore this backup.');
    return result;
  }

  async function getBackupSnapshot(): Promise<LocalBackupSnapshot> {
    const db = await database();
    let snapshot: LocalBackupSnapshot | null = null;
    await db.withTransactionAsync(async () => {
      const [
        profile,
        accounts,
        categories,
        transactions,
        budgets,
        monthlyBudgets,
        recurringRules,
        persons,
        debts,
        debtAdjustments,
        debtPayments,
        debtCashEvents,
        outbox,
      ] = await Promise.all([
        getProfileDetailsFrom(db),
        listRecordsFrom(db, 'account'),
        listRecordsFrom(db, 'category'),
        listRecordsFrom(db, 'transaction'),
        listRecordsFrom(db, 'budget'),
        listRecordsFrom(db, 'monthly_budget'),
        listRecordsFrom(db, 'recurring_rule'),
        listRecordsFrom(db, 'person'),
        listRecordsFrom(db, 'debt'),
        listRecordsFrom(db, 'debt_adjustment'),
        listRecordsFrom(db, 'debt_payment'),
        listRecordsFrom(db, 'debt_cash_event'),
        db.getAllAsync<{ payload: string; created_at: string }>('SELECT payload, created_at FROM outbox ORDER BY created_at ASC'),
      ]);
      snapshot = {
        profile,
        accounts,
        categories,
        transactions,
        budgets,
        monthlyBudgets,
        recurringRules,
        persons,
        debts,
        debtAdjustments,
        debtPayments,
        debtCashEvents,
        mutations: outbox.map((row) => JSON.parse(row.payload) as MobileSyncMutation),
        latestPendingChangeAt: outbox.at(-1)?.created_at ?? null,
      };
    });
    if (!snapshot) throw new Error('Unable to read the local backup snapshot');
    return snapshot;
  }

  async function savePendingBackupRestore(restore: PendingBackupRestore) {
    const db = await database();
    await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['pending_backup_restore', JSON.stringify(restore)]);
  }

  async function getPendingBackupRestore(): Promise<PendingBackupRestore | null> {
    const db = await database();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['pending_backup_restore']);
    if (!row) return null;
    try {
      const value = JSON.parse(row.value) as PendingBackupRestore;
      if (
        !value ||
        typeof value.file !== 'string' ||
        typeof value.backupId !== 'string' ||
        !value.entityCounts ||
        !value.preview ||
        value.preview.backupId !== value.backupId ||
        (value.stage !== 'preview-ready' && value.stage !== 'account-restored') ||
        (value.workspace !== 'local' && value.workspace !== 'online')
      ) return null;
      return value;
    } catch {
      return null;
    }
  }

  async function clearPendingBackupRestore() {
    const db = await database();
    await db.runAsync('DELETE FROM metadata WHERE key = ?', ['pending_backup_restore']);
  }

  async function getPendingSyncCount() {
    const db = await database();
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM outbox');
    return Number(row?.count ?? 0);
  }

  async function listTransactionPage({
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

  async function queueUpsert<E extends Entity>(entity: E, record: RecordFor<E>) {
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

  async function queueDelete(entity: Entity, recordId: string) {
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

  async function queueRecurringOccurrence({ action, expectedDueDate, rule, transaction }: { action: 'approve' | 'skip'; expectedDueDate: string; rule: MobileRecurringRule; transaction?: MobileTransaction }) {
    if (action === 'approve' && !transaction) throw new Error('Approving a recurring rule requires a transaction');
    const db = await database();
    const currentCursor = await getCursor();
    const mutation: MobileSyncMutation = action === 'approve'
      ? { mutationId: Crypto.randomUUID(), entity: 'recurring_rule', recordId: rule.id, operation: 'approve', baseCursor: currentCursor, expectedDueDate, transactionId: transaction!.id }
      : { mutationId: Crypto.randomUUID(), entity: 'recurring_rule', recordId: rule.id, operation: 'skip', baseCursor: currentCursor, expectedDueDate };
    await db.withTransactionAsync(async () => {
      if (transaction) await upsertRecord(db, 'transaction', transaction);
      await upsertRecord(db, 'recurring_rule', rule);
      await db.runAsync(
        'INSERT INTO outbox (mutation_id, entity, record_id, operation, base_cursor, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [mutation.mutationId, 'recurring_rule', rule.id, action, currentCursor, JSON.stringify(mutation), new Date().toISOString()],
      );
    });
  }

  async function upsertLocal<E extends Entity>(entity: E, record: RecordFor<E>) {
    const db = await database();
    await db.withTransactionAsync(async () => {
      await upsertRecord(db, entity, record);
    });
  }

  async function deleteLocal(entity: Entity, recordId: string) {
    const db = await database();
    await db.runAsync(`UPDATE ${table(entity)} SET deleted_at = ? WHERE id = ?`, [new Date().toISOString(), recordId]);
  }

  async function hardDeleteLocal(entity: Entity, recordId: string) {
    const db = await database();
    await db.runAsync(`DELETE FROM ${table(entity)} WHERE id = ?`, [recordId]);
  }

  async function outboxBatch(limit = 100): Promise<MobileSyncMutation[]> {
    const db = await database();
    const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox ORDER BY created_at ASC LIMIT ?', [limit]);
    return rows.map((row) => JSON.parse(row.payload) as MobileSyncMutation);
  }

  async function resolveOutbox(results: Array<{ mutationId: string; status: 'accepted' | 'rejected'; message?: string }>) {
    const db = await database();
    await db.withTransactionAsync(async () => {
      for (const result of results) {
        const pending = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM outbox WHERE mutation_id = ?', [result.mutationId]);
        await db.runAsync('DELETE FROM outbox WHERE mutation_id = ?', [result.mutationId]);
        if (result.status === 'rejected') {
          const mutation = pending ? JSON.parse(pending.payload) as MobileSyncMutation : null;
          if (mutation?.operation === 'approve') {
            await db.runAsync('DELETE FROM transactions WHERE id = ?', [mutation.transactionId]);
          }
          await db.runAsync('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)', ['last_sync_error', result.message ?? 'A change could not be synchronized']);
        }
      }
    });
  }

  async function takeLastSyncError() {
    const db = await database();
    const value = await db.getFirstAsync<{ value: string }>('SELECT value FROM metadata WHERE key = ?', ['last_sync_error']);
    if (value) await db.runAsync('DELETE FROM metadata WHERE key = ?', ['last_sync_error']);
    return value?.value ?? null;
  }

  async function reconcileChanges(changes: MobileSyncChange[], nextCursor: string) {
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

  async function clearLocalData() {
    const db = await database();
    await db.execAsync('DELETE FROM profile; DELETE FROM metadata; DELETE FROM accounts; DELETE FROM categories; DELETE FROM transactions; DELETE FROM budgets; DELETE FROM monthly_budgets; DELETE FROM recurring_rules; DELETE FROM persons; DELETE FROM debts; DELETE FROM debt_adjustments; DELETE FROM debt_payments; DELETE FROM debt_cash_events; DELETE FROM outbox;');
  }

  return {
    initializeDatabase,
    getCursor,
    saveProfile,
    getProfile,
    saveProfileDetails,
    getProfileDetails,
    getLastSyncedAt,
    getPendingSyncCount,
    getBackupSnapshot,
    savePendingBackupRestore,
    getPendingBackupRestore,
    clearPendingBackupRestore,
    previewBackupRestore,
    restoreBackup,
    listRecords,
    listTransactionPage,
    queueUpsert,
    queueDelete,
    queueRecurringOccurrence,
    upsertLocal,
    deleteLocal,
    hardDeleteLocal,
    outboxBatch,
    resolveOutbox,
    takeLastSyncError,
    reconcileChanges,
    clearLocalData,
  };
}

// Default instance for backward compatibility (online workspace)
export const defaultDb = createDatabase('faura-farmer.db');

// Re-export default instance functions for backward compatibility
export const initializeDatabase = defaultDb.initializeDatabase;
export const getCursor = defaultDb.getCursor;
export const saveProfile = defaultDb.saveProfile;
export const getProfile = defaultDb.getProfile;
export const saveProfileDetails = defaultDb.saveProfileDetails;
export const getProfileDetails = defaultDb.getProfileDetails;
export const getLastSyncedAt = defaultDb.getLastSyncedAt;
export const getPendingSyncCount = defaultDb.getPendingSyncCount;
export const listRecords = defaultDb.listRecords;
export const listTransactionPage = defaultDb.listTransactionPage;
export const queueUpsert = defaultDb.queueUpsert;
export const queueDelete = defaultDb.queueDelete;
export const queueRecurringOccurrence = defaultDb.queueRecurringOccurrence;
export const outboxBatch = defaultDb.outboxBatch;
export const resolveOutbox = defaultDb.resolveOutbox;
export const takeLastSyncError = defaultDb.takeLastSyncError;
export const reconcileChanges = defaultDb.reconcileChanges;
export const clearLocalData = defaultDb.clearLocalData;
