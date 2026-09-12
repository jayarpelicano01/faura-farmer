import { prisma, Prisma } from '@faura-farmer/database';
import type {
  AccountCurrency,
  AccountWithBalance,
  BudgetVarianceRow,
  BucketAllocation,
  BudgetBucket,
  BudgetWithCategory,
  Category,
  CategoryComparisonRow,
  CurrencyPreference,
  DebtSummary,
  MonthTotals,
  MonthlyBudget,
  MonthlyTrendPoint,
  SpendingByCategory,
  Transaction,
} from '@faura-farmer/types';
import { BUDGET_BUCKETS, convertMoney } from '@faura-farmer/types';
import { accountBalance, computeDebtCashNet, computeNetFromGrouped } from '@/lib/balance';
import { calculateDebtState, summarizeDebtBalances } from '@/lib/debt-ledger';
import { toNumber } from '@/lib/format';
import {
  calculatePercentageChange,
  utcEndOfMonth,
  utcEndOfYear,
  utcStartOfMonth,
  utcStartOfYear,
  type ReportRange,
} from '@/lib/reporting';
import { format, subDays, subMonths } from 'date-fns';

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

  const [grouped, debtCashGrouped] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['accountId', 'type', 'transferRole'],
      where: {
        account: { userId },
        type: { in: ['income', 'expense', 'transfer'] },
      },
      _sum: { amount: true },
    }),
    prisma.debtCashEvent.groupBy({
      by: ['accountId', 'direction'],
      where: { debt: { userId } },
      _sum: { amount: true },
    }),
  ]);

  const rowsByAccount = new Map<string, typeof grouped>();
  for (const row of grouped) {
    const rows = rowsByAccount.get(row.accountId) ?? [];
    rows.push(row);
    rowsByAccount.set(row.accountId, rows);
  }
  const debtRowsByAccount = new Map<string, typeof debtCashGrouped>();
  for (const row of debtCashGrouped) {
    const rows = debtRowsByAccount.get(row.accountId) ?? [];
    rows.push(row);
    debtRowsByAccount.set(row.accountId, rows);
  }

  return accounts.map<AccountWithBalance>((a) => ({
    ...a,
    startingBalance: String(a.startingBalance),
    balance: String(accountBalance(
      a.startingBalance,
      computeNetFromGrouped(rowsByAccount.get(a.id) ?? []) + computeDebtCashNet(debtRowsByAccount.get(a.id) ?? []),
    )),
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

export async function getDebtSummary(userId: string, preference: CurrencyPreference): Promise<DebtSummary> {
  const debts = await prisma.debt.findMany({
    where: { userId },
    include: { adjustments: { select: { amount: true } }, payments: { select: { amount: true } } },
  });
  return summarizeDebtBalances(debts.map((debt) => ({
    direction: debt.direction,
    currency: debt.currency,
    outstandingBalance: calculateDebtState({
      originalPrincipal: String(debt.originalPrincipal),
      adjustments: debt.adjustments.map((adjustment) => ({ amount: String(adjustment.amount) })),
      payments: debt.payments.map((payment) => ({ amount: String(payment.amount) })),
      status: debt.status,
    }).outstandingBalance,
  })), preference);
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
      select: { id: true, name: true, color: true },
    }),
  ]);

  if (grouped.length === 0) return [];

  const byId = new Map(categories.map((c) => [c.id, c]));

  const totals = new Map<string, number>();
  for (const g of grouped) {
    if (!g.categoryId) continue;
    totals.set(g.categoryId, (totals.get(g.categoryId) ?? 0) + toNumber(g._sum.amount));
  }

  return [...totals.entries()]
    .map(([categoryId, amount]) => {
      const category = byId.get(categoryId);
      return {
        categoryName: category?.name ?? 'Uncategorized',
        amount: String(amount),
        color: category?.color ?? null,
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

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { userId },
      type: 'expense',
      categoryId: { in: budgets.map((budget) => budget.categoryId) },
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
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
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

export type BalanceTimelinePeriod = '7d' | '30d' | '365d';
export type BalanceTimelinePoint = {
  id: string; label: string; from: string; to: string; balance: string; change: string;
  events: Array<{ id: string; date: string; description: string; amount: string; type: string }>;
};
export type CategorySpendingReportRow = { categoryName: string; color: string | null; amount: string };
type TimelineBucket = { id: string; label: string; from: Date; to: Date };

/** Mirrors the mobile report buckets: 7 daily, 6 five-day, or 12 monthly points. */
export function buildBalanceTimelineBuckets(period: BalanceTimelinePeriod, anchor = new Date()): TimelineBucket[] {
  const current = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12);
  if (period === '365d') return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(current.getFullYear(), current.getMonth() + index - 11, 1, 12);
    return { id: format(month, 'yyyy-MM'), label: format(month, 'MMM'), from: month, to: index === 11 ? current : new Date(month.getFullYear(), month.getMonth() + 1, 0, 12) };
  });
  const days = period === '7d' ? 7 : 30;
  const bucketSize = period === '7d' ? 1 : 5;
  const from = subDays(current, days - 1);
  return Array.from({ length: days / bucketSize }, (_, index) => {
    const bucketFrom = subDays(from, -(index * bucketSize));
    const bucketTo = subDays(bucketFrom, -(bucketSize - 1));
    return { id: format(bucketTo, 'yyyy-MM-dd'), label: format(bucketTo, 'MMM d'), from: bucketFrom, to: bucketTo };
  });
}

/** Builds display-currency closing balances using the mobile bucket boundaries. */
export async function getBalanceTimeline(userId: string, preference: CurrencyPreference, period: BalanceTimelinePeriod, accountId?: string): Promise<BalanceTimelinePoint[]> {
  const buckets = buildBalanceTimelineBuckets(period);
  const accounts = await prisma.account.findMany({ where: { userId, ...(accountId ? { id: accountId } : {}) }, select: { id: true, currency: true, startingBalance: true } });
  if (!accounts.length) return [];
  const [transactionRows, debtCashRows] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, accountId: { in: accounts.map((account) => account.id) }, date: { lte: buckets.at(-1)!.to } },
      select: { id: true, date: true, type: true, transferRole: true, amount: true, note: true, createdAt: true, category: { select: { name: true } }, account: { select: { currency: true } } },
    }),
    prisma.debtCashEvent.findMany({
      where: { debt: { userId }, accountId: { in: accounts.map((account) => account.id) }, date: { lte: buckets.at(-1)!.to } },
      select: { id: true, date: true, direction: true, amount: true, createdAt: true, debt: { select: { person: { select: { displayName: true } }, direction: true } }, account: { select: { currency: true } } },
    }),
  ]);
  const rows = [
    ...transactionRows.map((row) => ({ kind: 'transaction' as const, row })),
    ...debtCashRows.map((row) => ({ kind: 'debt_cash' as const, row })),
  ].sort((left, right) => left.row.date.getTime() - right.row.date.getTime()
    || left.row.createdAt.getTime() - right.row.createdAt.getTime()
    || left.row.id.localeCompare(right.row.id));
  let balance = accounts.reduce((total, account) => total + convertForDisplay(account.startingBalance, account.currency, preference), 0);
  const effect = (row: typeof rows[number]) => {
    const amount = convertForDisplay(row.row.amount, row.row.account.currency, preference);
    if (row.kind === 'debt_cash') return row.row.direction === 'in' ? amount : -amount;
    return row.row.type === 'income' || (row.row.type === 'transfer' && row.row.transferRole === 'incoming') ? amount : -amount;
  };
  let index = 0;
  while (index < rows.length && rows[index]!.row.date < buckets[0]!.from) balance += effect(rows[index++]!);
  return buckets.map((bucket) => {
    const opening = balance;
    const events: BalanceTimelinePoint['events'] = [];
    while (index < rows.length && rows[index]!.row.date <= bucket.to) {
      const row = rows[index++]!;
      if (row.row.date < bucket.from) continue;
      const amount = effect(row);
      balance += amount;
      if (row.kind === 'debt_cash') {
        const fallback = row.row.direction === 'in' ? `Debt cash received from ${row.row.debt.person.displayName}` : `Debt cash paid to ${row.row.debt.person.displayName}`;
        events.push({ id: row.row.id, date: format(row.row.date, 'MMM d, yyyy'), description: fallback, amount: String(amount), type: `debt_${row.row.direction}` });
      } else {
        const fallback = row.row.type === 'income' ? row.row.category?.name ?? 'Income' : row.row.type === 'expense' ? row.row.category?.name ?? 'Expense' : row.row.transferRole === 'incoming' ? 'Transfer received' : 'Transfer sent';
        events.push({ id: row.row.id, date: format(row.row.date, 'MMM d, yyyy'), description: row.row.note?.trim() || fallback, amount: String(amount), type: row.row.type === 'transfer' ? `transfer_${row.row.transferRole ?? 'outgoing'}` : row.row.type });
      }
    }
    return { id: bucket.id, label: bucket.label, from: format(bucket.from, 'yyyy-MM-dd'), to: format(bucket.to, 'yyyy-MM-dd'), balance: String(balance), change: String(balance - opening), events };
  });
}

export async function getCategorySpendingReport(userId: string, preference: CurrencyPreference, range: Pick<ReportRange, 'from' | 'to'>, accountId?: string): Promise<CategorySpendingReportRow[]> {
  const rows = await prisma.transaction.findMany({ where: { userId, type: 'expense', date: { gte: range.from, lte: range.to }, ...(accountId ? { accountId } : {}) }, select: { categoryId: true, amount: true, account: { select: { currency: true } }, category: { select: { name: true, color: true } } } });
  const totals = new Map<string, { categoryName: string; color: string | null; amount: number }>();
  for (const row of rows) {
    const id = row.categoryId ?? 'uncategorized';
    const current = totals.get(id) ?? { categoryName: row.category?.name ?? 'Uncategorized', color: row.category?.color ?? null, amount: 0 };
    current.amount += convertForDisplay(row.amount, row.account.currency, preference);
    totals.set(id, current);
  }
  return [...totals.values()].map((row) => ({ ...row, amount: String(row.amount) })).sort((left, right) => toNumber(right.amount) - toNumber(left.amount));
}

export async function getBudgetVarianceReport(
  userId: string,
  preference: CurrencyPreference,
  range: ReportRange,
): Promise<BudgetVarianceRow[]> {
  const budgetFrom = utcStartOfMonth(range.to);
  const [budgets, grouped] = await Promise.all([
    prisma.budget.findMany({
      where: { userId },
      include: {
        category: { select: { id: true, name: true, color: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
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

  const spentByCategory = new Map<string, number>();
  let uncategorized = 0;
  for (const row of grouped) {
    const amount = convertForDisplay(row.amount, row.account.currency, preference);
    if (row.categoryId) spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + amount);
    else uncategorized += amount;
  }

  const budgetedCategoryIds = new Set<string>();
  const rows = budgets.map<BudgetVarianceRow>((budget) => {
    budgetedCategoryIds.add(budget.categoryId);
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
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
      select: { id: true, name: true, color: true },
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

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const currentByCategory = new Map<string, number>();
  const previousByCategory = new Map<string, number>();
  const addToCategory = (target: Map<string, number>, categoryId: string | null, amount: number) => {
    const id = categoryId ?? 'uncategorized';
    target.set(id, (target.get(id) ?? 0) + amount);
  };

  for (const row of current) addToCategory(currentByCategory, row.categoryId, convertForDisplay(row.amount, row.account.currency, preference));
  for (const row of previous) addToCategory(previousByCategory, row.categoryId, convertForDisplay(row.amount, row.account.currency, preference));

  const categoryIds = new Set([...currentByCategory.keys(), ...previousByCategory.keys()]);
  return [...categoryIds]
    .map<CategoryComparisonRow>((categoryId) => {
      const currentAmount = currentByCategory.get(categoryId) ?? 0;
      const previousAmount = previousByCategory.get(categoryId) ?? 0;
      const category = categoriesById.get(categoryId);
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

export async function getCategoryTree(userId: string): Promise<{
  income: Category[];
  expense: Category[];
}> {
  const categories = await prisma.category.findMany({
    where: { userId },
  });

  return {
    income: categories.filter((category) => category.type === 'income'),
    expense: categories.filter((category) => category.type === 'expense'),
  };
}

export function currentYearRange() {
  return { from: utcStartOfYear(new Date()), to: utcEndOfYear(new Date()) };
}

export async function findConflictingBudget(
  userId: string,
  categoryId: string,
  excludeBudgetId?: string,
): Promise<{ id: string; categoryName: string } | null> {
  const existing = await prisma.budget.findFirst({
    where: {
      userId,
      categoryId,
      ...(excludeBudgetId ? { NOT: { id: excludeBudgetId } } : {}),
    },
    select: { id: true, category: { select: { name: true } } },
  });
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
      select: { id: true, bucket: true },
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

  const spent = new Map<BudgetBucket, number>();
  let unallocated = 0;
  for (const row of grouped) {
    if (!row.categoryId) continue;
    const amount = preference
      ? convertForDisplay(row.amount, row.account.currency, preference)
      : toNumber(row.amount);
    const bucket = row.bucket ?? byId.get(row.categoryId)?.bucket ?? null;
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
