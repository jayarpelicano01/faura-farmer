import { prisma, Prisma } from '@faura-farmer/database';
import type {
  AccountCurrency,
  AccountSpendingRow,
  AccountWithBalance,
  BudgetVarianceRow,
  BucketAllocation,
  BudgetBucket,
  BudgetWithCategory,
  CashFlowPoint,
  CashFlowSummary,
  Category,
  CategoryComparisonRow,
  CurrencyPreference,
  MonthTotals,
  MonthlyBudget,
  MonthlyTrendPoint,
  SpendingByCategory,
  Transaction,
} from '@faura-farmer/types';
import { BUDGET_BUCKETS, convertMoney } from '@faura-farmer/types';
import {
  calculatePercentageChange,
  calculateSavingsRate,
  utcEndOfMonth,
  utcEndOfYear,
  utcStartOfMonth,
  utcStartOfYear,
  type ReportRange,
} from '@/lib/reporting';
import { format, subDays, subMonths } from 'date-fns';

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function convertForDisplay(value: unknown, sourceCurrency: string, preference: CurrencyPreference) {
  return toNumber(convertMoney(String(value), sourceCurrency, preference.displayCurrency, preference.usdPerPhp));
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
    currency: a.currency as AccountCurrency,
  }));
}

export async function getMonthTotals(userId: string, month: Date): Promise<MonthTotals> {
  const from = utcStartOfMonth(month);
  const to = utcEndOfMonth(month);
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

export async function getDisplayMonthTotals(
  userId: string,
  month: Date,
  preference: CurrencyPreference,
): Promise<MonthTotals> {
  const from = utcStartOfMonth(month);
  const to = utcEndOfMonth(month);
  const rows = await prisma.transaction.findMany({
    where: {
      account: { userId },
      type: { in: ['income', 'expense'] },
      date: { gte: from, lte: to },
    },
    select: { type: true, amount: true, account: { select: { currency: true } } },
  });

  let income = 0;
  let expense = 0;
  for (const row of rows) {
    const amount = convertForDisplay(row.amount, row.account.currency, preference);
    if (row.type === 'income') income += amount;
    else expense += amount;
  }

  return { income: String(income), expense: String(expense), balance: String(income - expense) };
}

export async function getSpendingByCategory(
  userId: string,
  month: Date,
): Promise<SpendingByCategory[]> {
  const from = utcStartOfMonth(month);
  const to = utcEndOfMonth(month);

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
  preference?: CurrencyPreference,
): Promise<BudgetWithCategory[]> {
  const from = utcStartOfMonth(month);
  const to = utcEndOfMonth(month);

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

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId },
      type: 'expense',
      categoryId: { in: [...related] },
      date: { gte: from, lte: to },
    },
    select: { categoryId: true, amount: true, account: { select: { currency: true } } },
  });

  const spentByCategory = new Map<string, number>();
  for (const row of transactions) {
    if (!row.categoryId) continue;
    const amount = preference
      ? convertForDisplay(row.amount, row.account.currency, preference)
      : toNumber(row.amount);
    spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + amount);
  }

  return budgets.map<BudgetWithCategory>((budget) => {
    const spent =
      (membersByBudget.get(budget.categoryId) ?? []).reduce(
        (sum, id) => sum + (spentByCategory.get(id) ?? 0),
        0,
      );
    const limit = preference
      ? convertForDisplay(budget.monthlyLimit, 'PHP', preference)
      : toNumber(budget.monthlyLimit);
    const progress = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      monthlyLimit: String(limit),
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
  const from = utcStartOfMonth(subMonths(now, months - 1));
  const to = utcEndOfMonth(now);

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
    const month = utcStartOfMonth(subMonths(now, i));
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

export async function getReportCurrencies(userId: string): Promise<string[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { currency: true },
  });

  return [...new Set(accounts.map((account) => account.currency.toUpperCase()))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function reportAccountWhere(userId: string, currency: string) {
  return {
    userId,
    currency: { equals: currency, mode: 'insensitive' as const },
  };
}

function inRange(date: Date, range: Pick<ReportRange, 'from' | 'to'>) {
  return date >= range.from && date <= range.to;
}

export async function getCashFlowReport(
  userId: string,
  preference: CurrencyPreference,
  range: ReportRange,
): Promise<{ summary: CashFlowSummary; points: CashFlowPoint[] }> {
  const chartFrom =
    range.period === 'week' ? range.from : utcStartOfMonth(subMonths(range.to, 5));

  const rows = await prisma.transaction.findMany({
    where: {
      account: { userId },
      type: { in: ['income', 'expense'] },
      date: { gte: chartFrom, lte: range.to },
    },
    select: { date: true, type: true, amount: true, account: { select: { currency: true } } },
  });

  const amountsByKey = new Map<string, { income: number; expense: number }>();
  let summaryIncome = 0;
  let summaryExpense = 0;

  for (const row of rows) {
    const key = range.period === 'week' ? format(row.date, 'yyyy-MM-dd') : format(row.date, 'yyyy-MM');
    const amount = convertForDisplay(row.amount, row.account.currency, preference);
    const bucket = amountsByKey.get(key) ?? { income: 0, expense: 0 };
    if (row.type === 'income') {
      bucket.income += amount;
      if (inRange(row.date, range)) summaryIncome += amount;
    } else {
      bucket.expense += amount;
      if (inRange(row.date, range)) summaryExpense += amount;
    }
    amountsByKey.set(key, bucket);
  }

  const points: CashFlowPoint[] = [];
  const pointCount = range.period === 'week' ? 7 : 6;
  for (let index = pointCount - 1; index >= 0; index -= 1) {
    const pointDate = range.period === 'week' ? subDays(range.to, index) : subMonths(range.to, index);
    const key = range.period === 'week' ? format(pointDate, 'yyyy-MM-dd') : format(pointDate, 'yyyy-MM');
    const bucket = amountsByKey.get(key) ?? { income: 0, expense: 0 };
    const net = bucket.income - bucket.expense;
    points.push({
      label: range.period === 'week' ? format(pointDate, 'EEE') : format(pointDate, 'MMM'),
      income: String(bucket.income),
      expense: String(bucket.expense),
      net: String(net),
      savingsRate: calculateSavingsRate(bucket.income, bucket.expense),
    });
  }

  const net = summaryIncome - summaryExpense;
  return {
    summary: {
      income: String(summaryIncome),
      expense: String(summaryExpense),
      net: String(net),
      savingsRate: calculateSavingsRate(summaryIncome, summaryExpense),
    },
    points,
  };
}

export async function getBudgetVarianceReport(
  userId: string,
  preference: CurrencyPreference,
  range: ReportRange,
): Promise<BudgetVarianceRow[]> {
  const budgetFrom = utcStartOfMonth(range.to);
  const [budgets, categories, grouped] = await Promise.all([
    prisma.budget.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'expense',
        date: { gte: budgetFrom, lte: range.to },
      },
      select: { categoryId: true, amount: true, account: { select: { currency: true } } },
    }),
  ]);

  const { descendantsOf } = buildCategoryMaps(categories);
  const spentByCategory = new Map<string, number>();
  let uncategorized = 0;
  for (const row of grouped) {
    const amount = convertForDisplay(row.amount, row.account.currency, preference);
    if (row.categoryId) spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + amount);
    else uncategorized += amount;
  }

  const budgetedCategoryIds = new Set<string>();
  const rows = budgets.map<BudgetVarianceRow>((budget) => {
    const categoryIds = descendantsOf(budget.categoryId);
    let spent = 0;
    for (const categoryId of categoryIds) {
      budgetedCategoryIds.add(categoryId);
      spent += spentByCategory.get(categoryId) ?? 0;
    }
    const limit = convertForDisplay(budget.monthlyLimit, 'PHP', preference);
    const remaining = limit - spent;
    return {
      id: budget.id,
      categoryName: budget.category.name,
      color: budget.category.color,
      limit: String(limit),
      spent: String(spent),
      remaining: String(remaining),
      progress: limit > 0 ? (spent / limit) * 100 : 0,
      over: spent > limit,
      kind: 'budget',
    };
  });

  const unbudgeted = [...spentByCategory.entries()].reduce(
    (total, [categoryId, amount]) => total + (budgetedCategoryIds.has(categoryId) ? 0 : amount),
    0,
  );
  if (unbudgeted > 0) {
    rows.push({
      id: 'unbudgeted',
      categoryName: 'Unbudgeted spending',
      color: null,
      limit: '0',
      spent: String(unbudgeted),
      remaining: String(-unbudgeted),
      progress: 0,
      over: true,
      kind: 'unbudgeted',
    });
  }
  if (uncategorized > 0) {
    rows.push({
      id: 'uncategorized',
      categoryName: 'Uncategorized spending',
      color: null,
      limit: '0',
      spent: String(uncategorized),
      remaining: String(-uncategorized),
      progress: 0,
      over: true,
      kind: 'uncategorized',
    });
  }

  return rows;
}

export async function getCategoryComparisonReport(
  userId: string,
  preference: CurrencyPreference,
  range: ReportRange,
): Promise<CategoryComparisonRow[]> {
  const [categories, current, previous] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'expense',
        date: { gte: range.from, lte: range.to },
      },
      select: { categoryId: true, amount: true, account: { select: { currency: true } } },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'expense',
        date: { gte: range.previousFrom, lte: range.previousTo },
      },
      select: { categoryId: true, amount: true, account: { select: { currency: true } } },
    }),
  ]);

  const { rootOf } = buildCategoryMaps(categories);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const currentByRoot = new Map<string, number>();
  const previousByRoot = new Map<string, number>();
  const addToRoot = (target: Map<string, number>, categoryId: string | null, amount: number) => {
    const rootId = categoryId ? rootOf(categoryId) : 'uncategorized';
    target.set(rootId, (target.get(rootId) ?? 0) + amount);
  };

  for (const row of current) addToRoot(currentByRoot, row.categoryId, convertForDisplay(row.amount, row.account.currency, preference));
  for (const row of previous) addToRoot(previousByRoot, row.categoryId, convertForDisplay(row.amount, row.account.currency, preference));

  const rootIds = new Set([...currentByRoot.keys(), ...previousByRoot.keys()]);
  return [...rootIds]
    .map<CategoryComparisonRow>((rootId) => {
      const currentAmount = currentByRoot.get(rootId) ?? 0;
      const previousAmount = previousByRoot.get(rootId) ?? 0;
      const category = categoriesById.get(rootId);
      return {
        categoryName: category?.name ?? 'Uncategorized',
        color: category?.color ?? null,
        current: String(currentAmount),
        previous: String(previousAmount),
        change: String(currentAmount - previousAmount),
        percentageChange: calculatePercentageChange(currentAmount, previousAmount),
      };
    })
    .sort((a, b) => toNumber(b.current) - toNumber(a.current));
}

export async function getAccountSpendingReport(
  userId: string,
  preference: CurrencyPreference,
  range: ReportRange,
): Promise<AccountSpendingRow[]> {
  const [accounts, grouped] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { id: true, label: true, type: true, color: true, isArchived: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'expense',
        date: { gte: range.from, lte: range.to },
      },
      select: { accountId: true, amount: true, account: { select: { currency: true } } },
    }),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const total = grouped.reduce((sum, row) => sum + convertForDisplay(row.amount, row.account.currency, preference), 0);

  const spendingByAccount = new Map<string, { account: typeof accounts[number]; amount: number }>();
  for (const row of grouped) {
    const account = accountsById.get(row.accountId);
    if (!account) continue;
    const converted = convertForDisplay(row.amount, row.account.currency, preference);
    const existing = spendingByAccount.get(row.accountId);
    if (existing) {
      existing.amount += converted;
    } else {
      spendingByAccount.set(row.accountId, { account, amount: converted });
    }
  }

  return [...spendingByAccount.values()]
    .map<AccountSpendingRow>(({ account, amount }) => ({
      accountId: account.id,
      accountName: account.label,
      accountType: account.type,
      color: account.color,
      isArchived: account.isArchived,
      amount: String(amount),
      share: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
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
  return { from: utcStartOfYear(new Date()), to: utcEndOfYear(new Date()) };
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
  preference?: CurrencyPreference,
): Promise<MonthlyBudget> {
  const existing = await prisma.monthlyBudget.findUnique({ where: { userId } });
  if (existing) {
    const amount = preference
      ? convertForDisplay(existing.amount, 'PHP', preference)
      : toNumber(existing.amount);
    return { id: existing.id, userId: existing.userId, amount: String(amount) };
  }
  const totals = preference
    ? await getDisplayMonthTotals(userId, month, preference)
    : await getMonthTotals(userId, month);
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
  preference?: CurrencyPreference,
): Promise<BucketAllocation> {
  const from = utcStartOfMonth(month);
  const to = utcEndOfMonth(month);

  const [budget, categories, grouped] = await Promise.all([
    getMonthlyBudgetWithDefault(userId, month, preference),
    prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true, bucket: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { userId },
        type: 'expense',
        categoryId: { not: null },
        date: { gte: from, lte: to },
      },
      select: {
        categoryId: true,
        bucket: true,
        amount: true,
        account: { select: { currency: true } },
      },
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
    const amount = preference
      ? convertForDisplay(row.amount, row.account.currency, preference)
      : toNumber(row.amount);
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
