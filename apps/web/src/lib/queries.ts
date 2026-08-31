import { prisma, Prisma } from '@faura-farmer/database';
import type {
  AccountWithBalance,
  BucketAllocation,
  BudgetBucket,
  BudgetWithCategory,
  Category,
  MonthTotals,
  MonthlyBudget,
  MonthlyTrendPoint,
  SpendingByCategory,
  Transaction,
} from '@faura-farmer/types';
import { BUDGET_BUCKETS } from '@faura-farmer/types';
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const transactionWithRelations = {
  account: true,
  category: true,
} satisfies Prisma.TransactionInclude;

export type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof transactionWithRelations;
}>;

export interface LockedAccount {
  id: string;
  userId: string;
  currency: string;
}

/** Lock account rows in one global order before validating or writing transfers. */
export async function lockAccountsInOrder(
  tx: Prisma.TransactionClient,
  accountIds: string[],
  userId: string,
): Promise<LockedAccount[]> {
  const orderedIds = [...new Set(accountIds)].sort();
  if (orderedIds.length === 0) return [];

  const ids = Prisma.join(
    orderedIds.map((id) => Prisma.sql`CAST(${id} AS UUID)`),
  );
  return tx.$queryRaw<LockedAccount[]>(Prisma.sql`
    SELECT
      "id"::text AS "id",
      "user_id"::text AS "userId",
      "currency"
    FROM "accounts"
    WHERE "id" IN (${ids})
      AND "user_id" = CAST(${userId} AS UUID)
    ORDER BY "id"
    FOR UPDATE
  `);
}

function serializeAccount(account: TransactionWithRelations['account']) {
  return {
    ...account,
    startingBalance: String(account.startingBalance),
  };
}

/** Collapse linked transfer legs into one event represented by the outgoing row. */
export function toLogicalTransactions(rows: TransactionWithRelations[]): Transaction[] {
  const rowsByGroup = new Map<string, TransactionWithRelations[]>();
  for (const row of rows) {
    if (!row.transferGroupId) continue;
    const grouped = rowsByGroup.get(row.transferGroupId) ?? [];
    grouped.push(row);
    rowsByGroup.set(row.transferGroupId, grouped);
  }

  const emittedGroups = new Set<string>();
  const logical: Transaction[] = [];

  for (const row of rows) {
    let source = row;
    let destination: TransactionWithRelations | undefined;

    if (row.transferGroupId) {
      if (emittedGroups.has(row.transferGroupId)) continue;
      emittedGroups.add(row.transferGroupId);

      const grouped = rowsByGroup.get(row.transferGroupId) ?? [row];
      source = grouped.find((candidate) => candidate.transferRole === 'outgoing') ?? row;
      destination = grouped.find((candidate) => candidate.transferRole === 'incoming');
    }

    logical.push({
      ...source,
      amount: String(source.amount),
      transferGroupId: source.transferGroupId ?? null,
      transferRole: source.transferRole ?? null,
      destinationAccountId: destination?.accountId ?? null,
      account: serializeAccount(source.account),
      destinationAccount: destination ? serializeAccount(destination.account) : null,
      category: source.category ? { ...source.category } : null,
    } as Transaction);
  }

  return logical.sort((a, b) => {
    const dateOrder = b.date.getTime() - a.date.getTime();
    if (dateOrder !== 0) return dateOrder;

    const createdOrder = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdOrder !== 0) return createdOrder;

    return b.id.localeCompare(a.id);
  });
}

export async function getAccountsWithBalance(userId: string): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) return [];

  const grouped = await prisma.transaction.groupBy({
    by: ['accountId', 'type', 'transferRole'],
    where: {
      account: { userId },
      type: { in: ['income', 'expense', 'transfer'] },
    },
    _sum: { amount: true },
  });

  const netByAccount = new Map<string, number>();
  for (const row of grouped) {
    const current = netByAccount.get(row.accountId) ?? 0;
    const sum = toNumber(row._sum.amount);
    if (row.type === 'income' || (row.type === 'transfer' && row.transferRole === 'incoming')) {
      netByAccount.set(row.accountId, current + sum);
    } else {
      netByAccount.set(row.accountId, current - sum);
    }
  }

  return accounts.map<AccountWithBalance>((a) => ({
    ...a,
    startingBalance: String(a.startingBalance),
    balance: String(toNumber(a.startingBalance) + (netByAccount.get(a.id) ?? 0)),
  }));
}

export async function getMonthTotals(userId: string, month: Date): Promise<MonthTotals> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const empty: MonthTotals = { income: '0', expense: '0', balance: '0' };

  const grouped = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      account: { userId },
      type: { in: ['income', 'expense'] },
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });

  let income = 0;
  let expense = 0;
  for (const row of grouped) {
    if (row.type === 'income') income = toNumber(row._sum.amount);
    else expense = toNumber(row._sum.amount);
  }

  return {
    income: String(income),
    expense: String(expense),
    balance: String(income - expense),
  };
}

export async function getRecentTransactions(
  userId: string,
  limit = 8,
): Promise<Transaction[]> {
  const transactions = await prisma.transaction.findMany({
    where: { account: { userId } },
    include: transactionWithRelations,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  return toLogicalTransactions(transactions).slice(0, limit);
}

export async function getSpendingByCategory(
  userId: string,
  month: Date,
): Promise<SpendingByCategory[]> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const [grouped, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { userId },
        type: 'expense',
        categoryId: { not: null },
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
  ]);

  if (grouped.length === 0) return [];

  const { rootOf } = buildCategoryMaps(categories);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const buckets = new Map<string, number>();
  for (const g of grouped) {
    if (!g.categoryId) continue;
    const rootId = rootOf(g.categoryId);
    buckets.set(rootId, (buckets.get(rootId) ?? 0) + toNumber(g._sum.amount));
  }

  return [...buckets.entries()]
    .map(([rootId, amount]) => {
      const root = byId.get(rootId);
      return {
        categoryName: root?.name ?? 'Uncategorized',
        amount: String(amount),
        color: root?.color ?? null,
      };
    })
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
}

export async function getBudgetsWithProgress(
  userId: string,
  month: Date,
): Promise<BudgetWithCategory[]> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: {
      category: { select: { id: true, name: true, color: true, type: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (budgets.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { id: true, parentId: true },
  });
  const { descendantsOf } = buildCategoryMaps(categories);

  const related = new Set<string>();
  const membersByBudget = new Map<string, string[]>();
  for (const budget of budgets) {
    const members = [...descendantsOf(budget.categoryId)];
    membersByBudget.set(budget.categoryId, members);
    for (const id of members) related.add(id);
  }

  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      account: { userId },
      type: 'expense',
      categoryId: { in: [...related] },
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });

  const spentByCategory = new Map<string, number>();
  for (const row of grouped) {
    if (row.categoryId) spentByCategory.set(row.categoryId, toNumber(row._sum.amount));
  }

  return budgets.map<BudgetWithCategory>((budget) => {
    const spent =
      (membersByBudget.get(budget.categoryId) ?? []).reduce(
        (sum, id) => sum + (spentByCategory.get(id) ?? 0),
        0,
      );
    const limit = toNumber(budget.monthlyLimit);
    const progress = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      monthlyLimit: String(budget.monthlyLimit),
      createdAt: budget.createdAt,
      category: budget.category,
      spent: String(spent),
      remaining: String(limit - spent),
      progress,
      over: spent > limit,
    };
  });
}

export async function getMonthlyTrend(
  userId: string,
  months: number,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  const from = startOfMonth(subMonths(now, months - 1));
  const to = endOfMonth(now);

  const rows = await prisma.transaction.findMany({
    where: {
      account: { userId },
      type: { in: ['income', 'expense'] },
      date: { gte: from, lte: to },
    },
    select: { date: true, type: true, amount: true },
  });

  const buckets = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const key = format(row.date, 'yyyy-MM');
    const bucket = buckets.get(key) ?? { income: 0, expense: 0 };
    if (row.type === 'income') bucket.income += toNumber(row.amount);
    else bucket.expense += toNumber(row.amount);
    buckets.set(key, bucket);
  }

  const points: MonthlyTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = startOfMonth(subMonths(now, i));
    const key = format(month, 'yyyy-MM');
    const bucket = buckets.get(key) ?? { income: 0, expense: 0 };
    points.push({
      month: format(month, 'MMM'),
      income: String(bucket.income),
      expense: String(bucket.expense),
    });
  }

  return points;
}

export async function getCategoryTree(userId: string): Promise<{
  income: Category[];
  expense: Category[];
}> {
  const categories = await prisma.category.findMany({
    where: { userId },
  });

  const roots: Category[] = [];
  const childrenMap = new Map<string, Category[]>();

  for (const c of categories) {
    childrenMap.set(c.id, []);
  }
  for (const c of categories) {
    const node: Category = { ...c, children: [] };
    if (c.parentId && childrenMap.has(c.parentId)) {
      childrenMap.get(c.parentId)!.push(node);
    } else {
      roots.push(node);
    }
  }

  const attach = (node: Category): Category => ({
    ...node,
    children: childrenMap.get(node.id) ?? [],
  });

  const build = (list: Category[]): Category[] => list.map(attach);

  return {
    income: build(roots.filter((c) => c.type === 'income')),
    expense: build(roots.filter((c) => c.type === 'expense')),
  };
}

export function currentYearRange() {
  return { from: startOfYear(new Date()), to: endOfYear(new Date()) };
}

interface CategoryLink {
  id: string;
  parentId: string | null;
}

function buildCategoryMaps(categories: CategoryLink[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  function childrenOf(id: string): string[] {
    return categories.filter((c) => c.parentId === id).map((c) => c.id);
  }

  function rootOf(id: string): string {
    let current = id;
    let parent = byId.get(current)?.parentId;
    let guard = 0;
    while (parent && byId.has(parent) && guard < categories.length) {
      current = parent;
      parent = byId.get(current)?.parentId;
      guard += 1;
    }
    return current;
  }

  function descendantsOf(id: string): Set<string> {
    const result = new Set<string>([id]);
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const child of childrenOf(current)) {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      }
    }
    return result;
  }

  function ancestorsOf(id: string): string[] {
    const result: string[] = [];
    let current = byId.get(id)?.parentId;
    let guard = 0;
    while (current && byId.has(current) && guard < categories.length) {
      result.push(current);
      current = byId.get(current)?.parentId;
      guard += 1;
    }
    return result;
  }

  return { childrenOf, rootOf, descendantsOf, ancestorsOf };
}

export async function findConflictingBudget(
  userId: string,
  categoryId: string,
  excludeBudgetId?: string,
): Promise<{ id: string; categoryName: string } | null> {
  const [categories, budgets] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, parentId: true },
    }),
    prisma.budget.findMany({
      where: excludeBudgetId ? { userId, NOT: { id: excludeBudgetId } } : { userId },
      select: { id: true, categoryId: true, category: { select: { name: true } } },
    }),
  ]);

  if (budgets.length === 0) return null;

  const { descendantsOf, ancestorsOf } = buildCategoryMaps(categories);
  const related = new Set<string>([
    categoryId,
    ...descendantsOf(categoryId),
    ...ancestorsOf(categoryId),
  ]);

  const existing = budgets.find((b) => related.has(b.categoryId));
  if (!existing) return null;

  return { id: existing.id, categoryName: existing.category.name };
}

const BUCKET_SHARES: Record<BudgetBucket, number> = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
};

export async function getMonthlyBudgetWithDefault(
  userId: string,
  month: Date,
): Promise<MonthlyBudget> {
  const existing = await prisma.monthlyBudget.findUnique({ where: { userId } });
  if (existing) {
    return { id: existing.id, userId: existing.userId, amount: String(existing.amount) };
  }
  const totals = await getMonthTotals(userId, month);
  return { id: '', userId, amount: totals.income };
}

export async function setMonthlyBudget(
  userId: string,
  amount: number,
): Promise<MonthlyBudget> {
  const saved = await prisma.monthlyBudget.upsert({
    where: { userId },
    create: { userId, amount },
    update: { amount },
  });
  return { id: saved.id, userId: saved.userId, amount: String(saved.amount) };
}

export async function getBucketAllocation(
  userId: string,
  month: Date,
): Promise<BucketAllocation> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const [budget, categories, grouped] = await Promise.all([
    getMonthlyBudgetWithDefault(userId, month),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true, bucket: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId', 'bucket'],
      where: {
        account: { userId },
        type: 'expense',
        categoryId: { not: null },
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
    }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));

  function bucketOf(id: string): BudgetBucket | null {
    let current = id;
    let guard = 0;
    while (current && byId.has(current) && guard <= categories.length) {
      const cat = byId.get(current)!;
      if (cat.bucket) return cat.bucket;
      if (!cat.parentId) return null;
      current = cat.parentId;
      guard += 1;
    }
    return null;
  }

  const spent = new Map<BudgetBucket, number>();
  let unallocated = 0;
  for (const row of grouped) {
    if (!row.categoryId) continue;
    const amount = toNumber(row._sum.amount);
    const bucket = row.bucket ?? bucketOf(row.categoryId);
    if (bucket && BUDGET_BUCKETS.includes(bucket)) {
      spent.set(bucket, (spent.get(bucket) ?? 0) + amount);
    } else {
      unallocated += amount;
    }
  }

  const total = toNumber(budget.amount);
  const buckets = BUDGET_BUCKETS.map((bucket) => {
    const target = total * BUCKET_SHARES[bucket];
    const bucketSpent = spent.get(bucket) ?? 0;
    return {
      bucket,
      target: String(target),
      spent: String(bucketSpent),
      remaining: String(target - bucketSpent),
      progress: target > 0 ? (bucketSpent / target) * 100 : 0,
      over: bucketSpent > target,
    };
  });

  return {
    amount: String(total),
    persisted: budget.id !== '',
    buckets,
    unallocated: String(unallocated),
  };
}
