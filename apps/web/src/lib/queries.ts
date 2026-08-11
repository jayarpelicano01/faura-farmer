import { prisma } from '@faura-farmer/database';
import type {
  AccountWithBalance,
  Category,
  MonthTotals,
  MonthlyTrendPoint,
  SpendingByCategory,
  Transaction,
} from '@faura-farmer/types';
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

export async function getAccountsWithBalance(userId: string): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) return [];

  const grouped = await prisma.transaction.groupBy({
    by: ['accountId', 'type'],
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
    if (row.type === 'income') netByAccount.set(row.accountId, current + sum);
    else netByAccount.set(row.accountId, current - sum);
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
    include: { account: true, category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return transactions.map((t) => ({
    ...t,
    amount: String(t.amount),
    account: t.account ? { ...t.account, startingBalance: String(t.account.startingBalance) } : undefined,
    category: t.category ? { ...t.category } : null,
  })) as Transaction[];
}

export async function getSpendingByCategory(
  userId: string,
  month: Date,
): Promise<SpendingByCategory[]> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      account: { userId },
      type: 'expense',
      categoryId: { not: null },
      date: { gte: from, lte: to },
    },
    _sum: { amount: true },
  });

  const categoryIds = grouped
    .map((g) => g.categoryId)
    .filter((id): id is string => Boolean(id));

  if (categoryIds.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map<SpendingByCategory | null>((g) => {
      const category = g.categoryId ? categoryMap.get(g.categoryId) : undefined;
      if (!category) return null;
      return {
        categoryName: category.name,
        amount: String(toNumber(g._sum.amount)),
        color: category.color,
      };
    })
    .filter((c): c is SpendingByCategory => c !== null)
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
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