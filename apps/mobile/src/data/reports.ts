import { convertMoney, type CurrencyPreference, type MobileAccount, type MobileBudget, type MobileCategory, type MobileDebtCashEvent, type MobileTransaction } from '@faura-farmer/types';

export type BalanceTimelinePeriod = '7d' | '30d' | '365d';
export type CategorySpendingPeriod = 'week' | 'month';

export type BalanceEvent = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  change: string;
  balanceAfter: string;
  kind: 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'debt_in' | 'debt_out';
};

export type BalancePoint = {
  id: string;
  label: string;
  from: string;
  to: string;
  balance: string;
  change: string;
  events: BalanceEvent[];
};

export type CategorySpendingPoint = {
  categoryName: string;
  amount: string;
  color: string | null;
};

export type LocalBudgetVariance = {
  id: string;
  categoryName: string;
  color: string | null;
  limit: string;
  spent: string;
  remaining: string;
  over: boolean;
};

export type LocalCategoryComparison = {
  categoryName: string;
  color: string | null;
  current: string;
  previous: string;
  change: string;
  percentageChange: number | null;
};

type DateBucket = { id: string; label: string; from: string; to: string };

function localDate(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

function addDays(date: Date, amount: number) {
  const next = localDate(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return dateKey(date).slice(0, 7);
}

function labelFor(date: Date, withYear = false) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...(withYear ? { year: '2-digit' } : {}) }).format(date);
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value: number) {
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function converted(value: string, sourceCurrency: string, preference: CurrencyPreference) {
  return number(convertMoney(value, sourceCurrency, preference.displayCurrency, preference.usdPerPhp));
}

function timelineBuckets(period: BalanceTimelinePeriod, anchor = localDate()) {
  if (period === '365d') {
    return Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(anchor, index - 11);
      const from = month;
      const to = index === 11 ? anchor : endOfMonth(month);
      return {
        id: monthKey(month),
        label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(month),
        from: dateKey(from),
        to: dateKey(to),
      } satisfies DateBucket;
    });
  }

  const days = period === '7d' ? 7 : 30;
  const from = addDays(anchor, -(days - 1));
  const bucketSize = period === '7d' ? 1 : 5;
  const bucketCount = days / bucketSize;
  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketFrom = addDays(from, index * bucketSize);
    const bucketTo = addDays(bucketFrom, bucketSize - 1);
    return {
      id: dateKey(bucketTo),
      label: labelFor(bucketTo, period === '30d' && bucketTo.getMonth() === 0),
      from: dateKey(bucketFrom),
      to: dateKey(bucketTo),
    } satisfies DateBucket;
  });
}

function transactionEffect(
  transaction: MobileTransaction,
  accountId: string,
  accountCurrency: string,
  preference: CurrencyPreference,
) {
  const amount = converted(transaction.amount, accountCurrency, preference);
  if (transaction.type === 'income' && transaction.accountId === accountId) return amount;
  if (transaction.type === 'expense' && transaction.accountId === accountId) return -amount;
  if (transaction.type === 'transfer') {
    if (transaction.accountId === accountId) return -amount;
    if (transaction.destinationAccountId === accountId) return amount;
  }
  return 0;
}

function eventFor(
  transaction: MobileTransaction,
  accountId: string,
  accountsById: Map<string, MobileAccount>,
  categoriesById: Map<string, MobileCategory>,
  balanceAfter: number,
  accountCurrency: string,
  preference: CurrencyPreference,
): BalanceEvent {
  const change = transactionEffect(transaction, accountId, accountCurrency, preference);
  const category = transaction.categoryId ? categoriesById.get(transaction.categoryId)?.name : null;
  const otherAccountId = transaction.accountId === accountId ? transaction.destinationAccountId : transaction.accountId;
  const otherAccount = otherAccountId ? accountsById.get(otherAccountId)?.label : null;
  const kind = transaction.type === 'income'
    ? 'income'
    : transaction.type === 'expense'
      ? 'expense'
      : change >= 0 ? 'transfer_in' : 'transfer_out';
  const fallback = transaction.type === 'income'
    ? category ?? 'Income'
    : transaction.type === 'expense'
      ? category ?? 'Expense'
      : change >= 0 ? `Transfer from ${otherAccount ?? 'another account'}` : `Transfer to ${otherAccount ?? 'another account'}`;

  return {
    id: transaction.id,
    accountId,
    date: transaction.date,
    description: transaction.note?.trim() || fallback,
    change: decimal(change),
    balanceAfter: decimal(balanceAfter),
    kind,
  };
}

function debtCashEventFor(event: MobileDebtCashEvent, accountId: string, balanceAfter: number, accountCurrency: string, preference: CurrencyPreference): BalanceEvent {
  const change = (event.direction === 'in' ? 1 : -1) * converted(event.amount, accountCurrency, preference);
  return { id: event.id, accountId, date: event.date, description: event.direction === 'in' ? 'Debt cash received' : 'Debt cash paid', change: decimal(change), balanceAfter: decimal(balanceAfter), kind: event.direction === 'in' ? 'debt_in' : 'debt_out' };
}

function relevantTransactions(transactions: MobileTransaction[], accountId: string) {
  return transactions
    .filter((transaction) => transaction.accountId === accountId || transaction.destinationAccountId === accountId)
    .sort((left, right) => left.date.localeCompare(right.date) || left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
}

/**
 * Builds closing-balance points from the local synced ledger. Transfers are a
 * debit for their source account and a credit for their destination account.
 */
export function buildBalanceTimeline({
  account,
  accounts,
  categories,
  debtCashEvents = [],
  transactions,
  period,
  preference,
}: {
  account: MobileAccount;
  accounts: MobileAccount[];
  categories: MobileCategory[];
  debtCashEvents?: MobileDebtCashEvent[];
  transactions: MobileTransaction[];
  period: BalanceTimelinePeriod;
  preference: CurrencyPreference;
}): BalancePoint[] {
  const buckets = timelineBuckets(period);
  const ledger = relevantTransactions(transactions, account.id);
  const debtLedger = debtCashEvents.filter((event) => event.accountId === account.id).sort((left, right) => left.date.localeCompare(right.date) || left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id));
  const accountsById = new Map(accounts.map((item) => [item.id, item]));
  const categoriesById = new Map(categories.map((item) => [item.id, item]));
  let balance = converted(account.startingBalance, account.currency, preference);
  let transactionIndex = 0;
  let debtIndex = 0;

  while (transactionIndex < ledger.length && ledger[transactionIndex]!.date < buckets[0]!.from) {
    balance += transactionEffect(ledger[transactionIndex]!, account.id, account.currency, preference);
    transactionIndex += 1;
  }
  while (debtIndex < debtLedger.length && debtLedger[debtIndex]!.date < buckets[0]!.from) {
    const event = debtLedger[debtIndex++]!;
    balance += (event.direction === 'in' ? 1 : -1) * converted(event.amount, account.currency, preference);
  }

  return buckets.map((bucket) => {
    const openingBalance = balance;
    const events: BalanceEvent[] = [];
    while (transactionIndex < ledger.length && ledger[transactionIndex]!.date <= bucket.to) {
      const transaction = ledger[transactionIndex]!;
      if (transaction.date >= bucket.from) {
        balance += transactionEffect(transaction, account.id, account.currency, preference);
        events.push(
          eventFor(
            transaction,
            account.id,
            accountsById,
            categoriesById,
            balance,
            account.currency,
            preference,
          ),
        );
      }
      transactionIndex += 1;
    }
    while (debtIndex < debtLedger.length && debtLedger[debtIndex]!.date <= bucket.to) {
      const event = debtLedger[debtIndex++]!;
      if (event.date < bucket.from) continue;
      balance += (event.direction === 'in' ? 1 : -1) * converted(event.amount, account.currency, preference);
      events.push(debtCashEventFor(event, account.id, balance, account.currency, preference));
    }
    return {
      ...bucket,
      balance: decimal(balance),
      change: decimal(balance - openingBalance),
      events,
    };
  });
}

/** Combines account timelines for the All accounts reports selection. */
export function buildCombinedBalanceTimeline({
  accounts,
  categories,
  debtCashEvents = [],
  transactions,
  period,
  preference,
}: {
  accounts: MobileAccount[];
  categories: MobileCategory[];
  debtCashEvents?: MobileDebtCashEvent[];
  transactions: MobileTransaction[];
  period: BalanceTimelinePeriod;
  preference: CurrencyPreference;
}): BalancePoint[] {
  const timelines = accounts.map((account) => buildBalanceTimeline({ account, accounts, categories, debtCashEvents, transactions, period, preference }));
  return timelines[0]?.map((point, index) => ({
    ...point,
    balance: decimal(timelines.reduce((total, timeline) => total + number(timeline[index]?.balance ?? '0'), 0)),
    change: decimal(timelines.reduce((total, timeline) => total + number(timeline[index]?.change ?? '0'), 0)),
    events: timelines.flatMap((timeline) => timeline[index]?.events ?? []),
  })) ?? [];
}

export function categorySpendingRange(period: CategorySpendingPeriod, anchor: string) {
  const match = /^\d{4}-(\d{2})(?:-(\d{2}))?$/.exec(anchor);
  if (!match) return null;
  const [year, month, day] = anchor.split('-').map(Number);
  const parsed = new Date(year!, month! - 1, day ?? 1, 12);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month! - 1 || (day && parsed.getDate() !== day)) return null;
  const to = period === 'week' ? parsed : endOfMonth(parsed);
  const from = period === 'week' ? addDays(to, -6) : new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12);
  return { from: dateKey(from), to: dateKey(to) };
}

export function buildCategorySpending({
  accountId,
  accountCurrency,
  accounts,
  preference,
  categories,
  transactions,
  period,
  anchor,
}: {
  accountId: string | null;
  accountCurrency?: string;
  accounts?: MobileAccount[];
  preference: CurrencyPreference;
  categories: MobileCategory[];
  transactions: MobileTransaction[];
  period: CategorySpendingPeriod;
  anchor: string;
}): CategorySpendingPoint[] {
  const range = categorySpendingRange(period, anchor);
  if (!range) return [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map((accounts ?? []).map((account) => [account.id, account]));
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if ((accountId && transaction.accountId !== accountId) || transaction.type !== 'expense' || !transaction.categoryId) continue;
    if (transaction.date < range.from || transaction.date > range.to) continue;
    const id = transaction.categoryId;
    const currency = accountId ? accountCurrency ?? accountsById.get(transaction.accountId)?.currency ?? 'PHP' : accountsById.get(transaction.accountId)?.currency ?? 'PHP';
    totals.set(id, (totals.get(id) ?? 0) + converted(transaction.amount, currency, preference));
  }
  return [...totals.entries()]
    .map(([id, amount]) => {
      const category = categoriesById.get(id);
      return { categoryName: category?.name ?? 'Uncategorized', amount: decimal(amount), color: category?.color ?? null };
    })
    .sort((left, right) => number(right.amount) - number(left.amount));
}

export function defaultCategoryAnchor(period: CategorySpendingPeriod) {
  return period === 'week' ? dateKey(localDate()) : monthKey(localDate());
}

function parsedAnchor(period: CategorySpendingPeriod, anchor: string) {
  const range = categorySpendingRange(period, anchor);
  if (!range) return null;
  const [year, month] = range.to.split('-').map(Number);
  return new Date(year!, month! - 1, 1, 12);
}

function budgetRange(period: CategorySpendingPeriod, anchor: string) {
  const parsed = parsedAnchor(period, anchor);
  const range = categorySpendingRange(period, anchor);
  if (!parsed || !range) return null;
  return { from: dateKey(parsed), to: period === 'week' ? range.to : dateKey(endOfMonth(parsed)) };
}

/** Current PHP budget settings compared with all local expenses in the selected display currency. */
export function buildBudgetVariance({
  accounts,
  preference,
  budgets,
  categories,
  transactions,
  period,
  anchor,
}: {
  accounts: MobileAccount[];
  preference: CurrencyPreference;
  budgets: MobileBudget[];
  categories: MobileCategory[];
  transactions: MobileTransaction[];
  period: CategorySpendingPeriod;
  anchor: string;
}): LocalBudgetVariance[] {
  const range = budgetRange(period, anchor);
  if (!range) return [];
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const spentByCategory = new Map<string, number>();
  let uncategorized = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.date < range.from || transaction.date > range.to) continue;
    const amount = converted(transaction.amount, accountsById.get(transaction.accountId)?.currency ?? 'PHP', preference);
    if (transaction.categoryId) spentByCategory.set(transaction.categoryId, (spentByCategory.get(transaction.categoryId) ?? 0) + amount);
    else uncategorized += amount;
  }

  const budgetedCategoryIds = new Set<string>();
  const rows = budgets.flatMap<LocalBudgetVariance>((budget) => {
    const category = categoriesById.get(budget.categoryId);
    if (!category) return [];
    budgetedCategoryIds.add(budget.categoryId);
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    const limit = converted(budget.monthlyLimit, 'PHP', preference);
    const remaining = limit - spent;
    return [{ id: budget.id, categoryName: category.name, color: category.color, limit: decimal(limit), spent: decimal(spent), remaining: decimal(remaining), over: spent > limit }];
  });

  const unbudgeted = [...spentByCategory.entries()].reduce((total, [categoryId, spent]) => total + (budgetedCategoryIds.has(categoryId) ? 0 : spent), 0);
  if (unbudgeted > 0) rows.push({ id: 'unbudgeted', categoryName: 'Unbudgeted spending', color: null, limit: '0', spent: decimal(unbudgeted), remaining: decimal(-unbudgeted), over: true });
  if (uncategorized > 0) rows.push({ id: 'uncategorized', categoryName: 'Uncategorized spending', color: null, limit: '0', spent: decimal(uncategorized), remaining: decimal(-uncategorized), over: true });
  return rows;
}

function previousRange(period: CategorySpendingPeriod, anchor: string) {
  const current = categorySpendingRange(period, anchor);
  if (!current) return null;
  if (period === 'week') {
    const currentFrom = new Date(`${current.from}T12:00:00`);
    const previousTo = addDays(currentFrom, -1);
    return { from: dateKey(addDays(previousTo, -6)), to: dateKey(previousTo) };
  }
  const currentMonth = parsedAnchor(period, anchor);
  if (!currentMonth) return null;
  const previousMonth = addMonths(currentMonth, -1);
  return { from: dateKey(previousMonth), to: dateKey(endOfMonth(previousMonth)) };
}

function categorySpendingForRange({ accounts, preference, transactions, from, to }: { accounts: MobileAccount[]; preference: CurrencyPreference; transactions: MobileTransaction[]; from: string; to: string }) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.date < from || transaction.date > to) continue;
    const id = transaction.categoryId ?? 'uncategorized';
    totals.set(id, (totals.get(id) ?? 0) + converted(transaction.amount, accountsById.get(transaction.accountId)?.currency ?? 'PHP', preference));
  }
  return totals;
}

export function buildCategoryComparison({
  accounts,
  preference,
  categories,
  transactions,
  period,
  anchor,
}: {
  accounts: MobileAccount[];
  preference: CurrencyPreference;
  categories: MobileCategory[];
  transactions: MobileTransaction[];
  period: CategorySpendingPeriod;
  anchor: string;
}): LocalCategoryComparison[] {
  const currentRange = categorySpendingRange(period, anchor);
  const priorRange = previousRange(period, anchor);
  if (!currentRange || !priorRange) return [];
  const current = categorySpendingForRange({ accounts, preference, transactions, ...currentRange });
  const previous = categorySpendingForRange({ accounts, preference, transactions, ...priorRange });
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  return [...new Set([...current.keys(), ...previous.keys()])]
    .map((id) => {
      const currentAmount = current.get(id) ?? 0;
      const previousAmount = previous.get(id) ?? 0;
      const category = categoriesById.get(id);
      return {
        categoryName: category?.name ?? 'Uncategorized', color: category?.color ?? null,
        current: decimal(currentAmount), previous: decimal(previousAmount), change: decimal(currentAmount - previousAmount),
        percentageChange: previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : null,
      } satisfies LocalCategoryComparison;
    })
    .sort((left, right) => number(right.current) - number(left.current));
}
