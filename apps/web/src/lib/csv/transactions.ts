import { randomUUID } from 'node:crypto';
import { prisma, type Prisma } from '@faura-farmer/database';
import { BUDGET_BUCKETS, TRANSACTION_SOURCES, type BudgetBucket, type TransactionType } from '@faura-farmer/types';

export const CSV_COLUMNS = [
  'transaction_id',
  'transfer_group_id',
  'transfer_role',
  'account_id',
  'account_name',
  'destination_account_id',
  'destination_account_name',
  'category_id',
  'category_name',
  'bucket',
  'amount',
  'type',
  'date',
  'note',
  'source',
  'recurring_rule_id',
] as const;

export const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 10_000;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRecord = Record<CsvColumn, string>;
type MappableType = 'account' | 'category';

export class CsvImportError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export type CsvMappings = {
  accounts?: Record<string, string>;
  categories?: Record<string, string>;
};

export type CsvPreviewRow = {
  index: number;
  transactionId: string;
  type: TransactionType | null;
  date: string | null;
  amount: string | null;
  accountName: string;
  destinationAccountName: string;
  categoryName: string;
  note: string;
  errors: string[];
  duplicate: boolean;
};

type MappingNeed = {
  key: string;
  name: string;
  candidates: Array<{ id: string; label: string; type?: 'income' | 'expense' }>;
};

type ParsedRow = {
  index: number;
  raw: CsvRecord;
  errors: string[];
  type: TransactionType | null;
  date: Date | null;
  amount: string | null;
};

type ResolvedRow = ParsedRow & {
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  recurringRuleId: string | null;
  fingerprint: string | null;
  duplicate: boolean;
  accountNeeds?: MappingNeed;
  destinationAccountNeeds?: MappingNeed;
  categoryNeeds?: MappingNeed;
};

type ImportContext = {
  accounts: Array<{ id: string; label: string; currency: string }>;
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>;
  recurringRules: Array<{ id: string; type: 'income' | 'expense' }>;
  existing: Array<{
    id: string;
    externalTransactionId: string | null;
    accountId: string;
    categoryId: string | null;
    amount: Prisma.Decimal;
    type: TransactionType;
    transferGroupId: string | null;
    transferRole: 'outgoing' | 'incoming' | null;
    date: Date;
    note: string | null;
  }>;
};

function normalized(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function exactDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizedAmount(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) return null;
  const [whole, decimal = ''] = value.split('.');
  return `${String(Number(whole))}.${decimal.padEnd(2, '0')}`;
}

function csvRows(text: string): string[][] {
  if (text.includes('\0') || text.includes('\uFFFD')) throw new CsvImportError('CSV file is malformed');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      if (!atCellStart) throw new CsvImportError('CSV contains an invalid quoted field');
      quoted = true;
      atCellStart = false;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
      atCellStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      atCellStart = true;
    } else {
      cell += char;
      atCellStart = false;
    }
  }
  if (quoted) throw new CsvImportError('CSV contains an unclosed quoted field');
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseTransactionCsv(text: string): ParsedRow[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new CsvImportError('CSV file is empty');
  const header = rows[0]!.map((value) => value.trim());
  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new CsvImportError(`CSV is missing required columns: ${missing.join(', ')}`);
  if (rows.length - 1 > MAX_CSV_ROWS) {
    throw new CsvImportError(`CSV cannot contain more than ${MAX_CSV_ROWS.toLocaleString()} rows`, 413);
  }

  const indexByColumn = new Map(header.map((value, index) => [value, index]));
  const ids = new Map<string, number>();
  const parsed = rows.slice(1).map((values, index): ParsedRow => {
    const raw = Object.fromEntries(
      CSV_COLUMNS.map((column) => [column, (values[indexByColumn.get(column)!] ?? '').trim()]),
    ) as CsvRecord;
    const errors: string[] = [];
    if (values.length !== header.length) errors.push('CSV row has the wrong number of columns');

    const type = (['income', 'expense', 'transfer'] as const).includes(raw.type as TransactionType)
      ? (raw.type as TransactionType)
      : null;
    if (!type) errors.push('Type must be income, expense, or transfer');

    const date = exactDate(raw.date);
    if (!date) errors.push('Date must be a valid YYYY-MM-DD value');
    const amount = normalizedAmount(raw.amount);
    if (!amount) errors.push('Amount must be a positive value with at most two decimal places');
    if (!raw.transaction_id) {
      errors.push('transaction_id is required');
    } else if (!isUuid(raw.transaction_id)) {
      errors.push('transaction_id must be a UUID');
    } else if (ids.has(raw.transaction_id)) {
      errors.push(`Duplicate transaction_id also appears on row ${ids.get(raw.transaction_id)! + 1}`);
    } else {
      ids.set(raw.transaction_id, index + 2);
    }

    if (raw.account_id && !isUuid(raw.account_id)) errors.push('account_id must be a UUID');
    if (!raw.account_id && !raw.account_name) errors.push('An account ID or account name is required');
    if (raw.category_id && !isUuid(raw.category_id)) errors.push('category_id must be a UUID');
    if (raw.recurring_rule_id && !isUuid(raw.recurring_rule_id)) {
      errors.push('recurring_rule_id must be a UUID');
    }
    if (raw.bucket && !BUDGET_BUCKETS.includes(raw.bucket as BudgetBucket)) {
      errors.push('Bucket must be needs, wants, savings, or blank');
    }
    if (raw.source && !TRANSACTION_SOURCES.includes(raw.source as (typeof TRANSACTION_SOURCES)[number])) {
      errors.push('Source is invalid');
    }

    if (type === 'transfer') {
      if (!raw.transfer_group_id || !isUuid(raw.transfer_group_id)) {
        errors.push('Transfers require a transfer_group_id UUID');
      }
      if (raw.transfer_role !== 'outgoing') errors.push('Transfers must use transfer_role outgoing');
      if (raw.destination_account_id && !isUuid(raw.destination_account_id)) {
        errors.push('destination_account_id must be a UUID');
      }
      if (!raw.destination_account_id && !raw.destination_account_name) {
        errors.push('Transfers require a destination account ID or name');
      }
      if (raw.category_id || raw.category_name || raw.bucket) {
        errors.push('Transfers cannot include a category or budget bucket');
      }
    } else if (type) {
      if (raw.transfer_group_id || raw.transfer_role || raw.destination_account_id || raw.destination_account_name) {
        errors.push('Only transfers can include transfer fields');
      }
      if (type === 'income' && raw.bucket) errors.push('Income cannot include a budget bucket');
    }
    return { index: index + 2, raw, errors, type, date, amount };
  });
  return parsed;
}

function mappingKey(type: MappableType, name: string, categoryType?: 'income' | 'expense') {
  return `${type}:${categoryType ? `${categoryType}:` : ''}${normalized(name)}`;
}

function makeFingerprint(values: {
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  amount: string;
  type: TransactionType;
  date: Date;
  note?: string | null;
}) {
  return [
    values.type,
    values.accountId,
    values.destinationAccountId ?? '',
    values.categoryId ?? '',
    values.amount,
    dateKey(values.date),
    normalized(values.note ?? ''),
  ].join('|');
}

function buildExistingFingerprints(existing: ImportContext['existing']) {
  const byGroup = new Map<string, ImportContext['existing']>();
  for (const row of existing) {
    if (!row.transferGroupId) continue;
    const grouped = byGroup.get(row.transferGroupId) ?? [];
    grouped.push(row);
    byGroup.set(row.transferGroupId, grouped);
  }
  const fingerprints = new Set<string>();
  for (const row of existing) {
    if (row.type === 'transfer') {
      if (row.transferRole !== 'outgoing') continue;
      const destination = row.transferGroupId
        ? byGroup.get(row.transferGroupId)?.find((candidate) => candidate.transferRole === 'incoming')
        : null;
      if (!destination) continue;
      fingerprints.add(
        makeFingerprint({
          accountId: row.accountId,
          destinationAccountId: destination.accountId,
          amount: String(row.amount),
          type: 'transfer',
          date: row.date,
          note: row.note,
        }),
      );
    } else {
      fingerprints.add(
        makeFingerprint({
          accountId: row.accountId,
          categoryId: row.categoryId,
          amount: String(row.amount),
          type: row.type,
          date: row.date,
          note: row.note,
        }),
      );
    }
  }
  return fingerprints;
}

function resolveRows(parsed: ParsedRow[], context: ImportContext, mappings: CsvMappings = {}) {
  const accountsById = new Map(context.accounts.map((account) => [account.id, account]));
  const categoriesById = new Map(context.categories.map((category) => [category.id, category]));
  const rulesById = new Map(context.recurringRules.map((rule) => [rule.id, rule]));
  const existingIds = new Set(
    context.existing.flatMap((transaction) =>
      [transaction.id, transaction.externalTransactionId].filter((id): id is string => Boolean(id)),
    ),
  );
  const existingFingerprints = buildExistingFingerprints(context.existing);
  const fileFingerprints = new Set<string>();
  const accountNeeds = new Map<string, MappingNeed>();
  const categoryNeeds = new Map<string, MappingNeed>();

  function resolveAccount(
    id: string,
    name: string,
    errors: string[],
    fieldLabel: string,
  ): { id: string | null; need?: MappingNeed } {
    if (id) {
      if (!accountsById.has(id)) errors.push(`${fieldLabel} does not belong to you`);
      return { id: accountsById.has(id) ? id : null };
    }
    const key = mappingKey('account', name);
    const mappedId = mappings.accounts?.[key];
    if (mappedId && accountsById.has(mappedId)) return { id: mappedId };
    if (mappedId) errors.push(`Mapped ${fieldLabel.toLowerCase()} does not belong to you`);
    const need: MappingNeed = {
      key,
      name,
      candidates: context.accounts.map((account) => ({ id: account.id, label: account.label })),
    };
    accountNeeds.set(key, need);
    errors.push(`Map ${fieldLabel.toLowerCase()} "${name}" explicitly before import`);
    return { id: null, need };
  }

  function resolveCategory(
    id: string,
    name: string,
    type: 'income' | 'expense',
    errors: string[],
  ): { id: string | null; need?: MappingNeed } {
    if (!id && !name) return { id: null };
    if (id) {
      const category = categoriesById.get(id);
      if (!category) errors.push('Category does not belong to you');
      else if (category.type !== type) errors.push('Category type does not match the transaction type');
      return { id: category?.type === type ? id : null };
    }
    const key = mappingKey('category', name, type);
    const mappedId = mappings.categories?.[key];
    const mapped = mappedId ? categoriesById.get(mappedId) : null;
    if (mapped?.type === type) return { id: mapped.id };
    if (mappedId) errors.push('Mapped category does not belong to you or has the wrong type');
    const need: MappingNeed = {
      key,
      name,
      candidates: context.categories
        .filter((category) => category.type === type)
        .map((category) => ({ id: category.id, label: category.name, type: category.type })),
    };
    categoryNeeds.set(key, need);
    errors.push(`Map category "${name}" explicitly before import`);
    return { id: null, need };
  }

  const rows: ResolvedRow[] = parsed.map((row) => {
    const errors = [...row.errors];
    const account = resolveAccount(row.raw.account_id, row.raw.account_name, errors, 'Account');
    const destination =
      row.type === 'transfer'
        ? resolveAccount(
            row.raw.destination_account_id,
            row.raw.destination_account_name,
            errors,
            'Destination account',
          )
        : { id: null };
    if (row.type === 'transfer' && account.id && destination.id) {
      if (account.id === destination.id) errors.push('Transfer accounts must be different');
      const sourceCurrency = accountsById.get(account.id)?.currency.toUpperCase();
      const destinationCurrency = accountsById.get(destination.id)?.currency.toUpperCase();
      if (sourceCurrency !== destinationCurrency) errors.push('Transfer accounts must use the same currency');
    }
    const category =
      row.type === 'income' || row.type === 'expense'
        ? resolveCategory(row.raw.category_id, row.raw.category_name, row.type, errors)
        : { id: null };
    if (row.raw.recurring_rule_id) {
      const rule = rulesById.get(row.raw.recurring_rule_id);
      if (!rule) errors.push('Recurring rule does not belong to you');
      else if (rule.type !== row.type) errors.push('Recurring rule type does not match the transaction type');
    }
    const fingerprint =
      row.type && row.date && row.amount && account.id &&
      (row.type !== 'transfer' || destination.id)
        ? makeFingerprint({
            accountId: account.id,
            destinationAccountId: destination.id,
            categoryId: category.id,
            amount: row.amount,
            type: row.type,
            date: row.date,
            note: row.raw.note || null,
          })
        : null;
    const duplicate = Boolean(
      (row.raw.transaction_id && existingIds.has(row.raw.transaction_id)) ||
        (fingerprint && (existingFingerprints.has(fingerprint) || fileFingerprints.has(fingerprint))),
    );
    if (fingerprint) fileFingerprints.add(fingerprint);
    return {
      ...row,
      errors,
      accountId: account.id,
      destinationAccountId: destination.id,
      categoryId: category.id,
      recurringRuleId: rulesById.has(row.raw.recurring_rule_id) ? row.raw.recurring_rule_id || null : null,
      fingerprint,
      duplicate,
      accountNeeds: account.need,
      destinationAccountNeeds: destination.need,
      categoryNeeds: category.need,
    };
  });

  return { rows, accountNeeds: [...accountNeeds.values()], categoryNeeds: [...categoryNeeds.values()] };
}

async function importContext(userId: string, parsed: ParsedRow[]): Promise<ImportContext> {
  const dates = parsed.flatMap((row) => (row.date ? [row.date] : []));
  const transactionIds = parsed.flatMap((row) => (isUuid(row.raw.transaction_id) ? [row.raw.transaction_id] : []));
  const from = dates.length > 0 ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date(0);
  const to = dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : new Date(0);
  const [accounts, categories, recurringRules, existing] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { id: true, label: true, currency: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    }),
    prisma.recurringRule.findMany({
      where: { userId },
      select: { id: true, type: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { date: { gte: from, lte: to } },
          ...(transactionIds.length > 0
            ? [{ id: { in: transactionIds } }, { externalTransactionId: { in: transactionIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        externalTransactionId: true,
        accountId: true,
        categoryId: true,
        amount: true,
        type: true,
        transferGroupId: true,
        transferRole: true,
        date: true,
        note: true,
      },
    }),
  ]);
  return {
    accounts,
    categories,
    recurringRules: recurringRules.flatMap((rule) =>
      rule.type === 'income' || rule.type === 'expense' ? [{ ...rule, type: rule.type }] : [],
    ),
    existing,
  };
}

function asPreviewRow(row: ResolvedRow): CsvPreviewRow {
  return {
    index: row.index,
    transactionId: row.raw.transaction_id,
    type: row.type,
    date: row.date ? dateKey(row.date) : null,
    amount: row.amount,
    accountName: row.raw.account_name,
    destinationAccountName: row.raw.destination_account_name,
    categoryName: row.raw.category_name,
    note: row.raw.note,
    errors: row.errors,
    duplicate: row.duplicate,
  };
}

export async function previewCsvImport(userId: string, text: string, mappings: CsvMappings = {}) {
  const parsed = parseTransactionCsv(text);
  const context = await importContext(userId, parsed);
  const resolved = resolveRows(parsed, context, mappings);
  return {
    rows: resolved.rows.map(asPreviewRow),
    unresolvedAccounts: resolved.accountNeeds,
    unresolvedCategories: resolved.categoryNeeds,
    summary: {
      total: resolved.rows.length,
      invalid: resolved.rows.filter((row) => row.errors.length > 0).length,
      duplicates: resolved.rows.filter((row) => row.duplicate).length,
    },
  };
}

export async function confirmCsvImport(
  userId: string,
  text: string,
  mappings: CsvMappings,
  excludedRows: number[],
) {
  const parsed = parseTransactionCsv(text);
  const context = await importContext(userId, parsed);
  const { rows } = resolveRows(parsed, context, mappings);
  const excluded = new Set(excludedRows);
  const selected = rows.filter((row) => !excluded.has(row.index));
  if (selected.length === 0) throw new CsvImportError('Select at least one valid row to import');
  const invalid = selected.find((row) => row.errors.length > 0);
  if (invalid) throw new CsvImportError(`Row ${invalid.index}: ${invalid.errors[0]}`);
  const duplicate = selected.find((row) => row.duplicate);
  if (duplicate) {
    throw new CsvImportError(`Row ${duplicate.index} is a duplicate candidate; exclude it before importing`);
  }

  const selectedAccountIds = selected.flatMap((row) =>
    [row.accountId, row.destinationAccountId].filter((id): id is string => Boolean(id)),
  );
  const result = await prisma.$transaction(async (tx) => {
    const { lockAccountsInOrder } = await import('../queries');
    const lockedAccounts = await lockAccountsInOrder(tx, selectedAccountIds, userId);
    const lockedById = new Map(lockedAccounts.map((account) => [account.id, account]));
    if (new Set(selectedAccountIds).size !== lockedById.size) {
      throw new CsvImportError('An account was removed before the import could be confirmed');
    }
    const categoryIds = selected.flatMap((row) => (row.categoryId ? [row.categoryId] : []));
    const categories =
      categoryIds.length > 0
        ? await tx.category.findMany({
            where: { id: { in: [...new Set(categoryIds)] }, userId },
            select: { id: true, type: true },
          })
        : [];
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    if (categoriesById.size !== new Set(categoryIds).size) {
      throw new CsvImportError('A category was removed before the import could be confirmed');
    }

    for (const row of selected) {
      if (!row.accountId || !row.type || !row.amount || !row.date) {
        throw new CsvImportError(`Row ${row.index} could not be resolved`);
      }
      const category = row.categoryId ? categoriesById.get(row.categoryId) : null;
      if (category && category.type !== row.type) {
        throw new CsvImportError(`Row ${row.index} category type no longer matches the transaction`);
      }
      if (row.type === 'transfer') {
        if (!row.destinationAccountId) throw new CsvImportError(`Row ${row.index} has an incomplete transfer`);
        const source = lockedById.get(row.accountId);
        const destination = lockedById.get(row.destinationAccountId);
        if (!source || !destination || source.id === destination.id || source.currency.toUpperCase() !== destination.currency.toUpperCase()) {
          throw new CsvImportError(`Row ${row.index} has invalid transfer accounts`);
        }
        const transferGroupId = randomUUID();
        await tx.transaction.createMany({
          data: [
            {
              accountId: source.id,
              userId,
              amount: row.amount,
              type: 'transfer',
              transferGroupId,
              transferRole: 'outgoing',
              date: row.date,
              note: row.raw.note || null,
              source: 'csv_import',
              externalTransactionId: row.raw.transaction_id,
            },
            {
              accountId: destination.id,
              userId,
              amount: row.amount,
              type: 'transfer',
              transferGroupId,
              transferRole: 'incoming',
              date: row.date,
              note: row.raw.note || null,
              source: 'csv_import',
              externalTransactionId: `${row.raw.transaction_id}:incoming`,
            },
          ],
        });
      } else {
        await tx.transaction.create({
          data: {
            accountId: row.accountId,
            userId,
            categoryId: row.categoryId,
            bucket: row.raw.bucket ? (row.raw.bucket as BudgetBucket) : null,
            amount: row.amount,
            type: row.type,
            date: row.date,
            note: row.raw.note || null,
            source: 'csv_import',
            externalTransactionId: row.raw.transaction_id,
            recurringRuleId: row.recurringRuleId,
          },
        });
      }
    }
    return { imported: selected.length };
  });
  return result;
}

function escapedCell(value: string | null | undefined) {
  const raw = value ?? '';
  const spreadsheetSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(spreadsheetSafe)
    ? `"${spreadsheetSafe.replace(/"/g, '""')}"`
    : spreadsheetSafe;
}

export function toTransactionsCsv(
  rows: Array<{
    id: string;
    transferGroupId: string | null;
    transferRole: 'outgoing' | 'incoming' | null;
    accountId: string;
    categoryId: string | null;
    bucket: BudgetBucket | null;
    amount: Prisma.Decimal;
    type: TransactionType;
    date: Date;
    note: string | null;
    source: string;
    recurringRuleId: string | null;
    account: { label: string };
    category: { name: string } | null;
  }>,
  incomingByGroup: Map<string, { accountId: string; account: { label: string } }>,
) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    const destination = row.transferGroupId ? incomingByGroup.get(row.transferGroupId) : undefined;
    const values: Record<CsvColumn, string> = {
      transaction_id: row.id,
      transfer_group_id: row.transferGroupId ?? '',
      transfer_role: row.transferRole ?? '',
      account_id: row.accountId,
      account_name: row.account.label,
      destination_account_id: destination?.accountId ?? '',
      destination_account_name: destination?.account.label ?? '',
      category_id: row.categoryId ?? '',
      category_name: row.category?.name ?? '',
      bucket: row.bucket ?? '',
      amount: String(row.amount),
      type: row.type,
      date: dateKey(row.date),
      note: row.note ?? '',
      source: row.source,
      recurring_rule_id: row.recurringRuleId ?? '',
    };
    lines.push(CSV_COLUMNS.map((column) => escapedCell(values[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
