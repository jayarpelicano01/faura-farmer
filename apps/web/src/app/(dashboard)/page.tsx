import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@faura-farmer/database';
import { convertMoney } from '@faura-farmer/types';
import {
  getAccountsWithBalance,
  getBucketAllocation,
  getBudgetsWithProgress,
  getDisplayMonthTotals,
  getDebtSummary,
  getRecentTransactions,
} from '@/lib/queries';
import { toNumber } from '@/lib/format';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';
import {
  AccountSummary,
  BalanceCards,
  DebtSummaryCard,
  BudgetOverview,
  MonthlyBudgetOverview,
  RecentTransactions,
} from '@/components/dashboard/widgets';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [user, accounts, recent] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: currencyPreferenceSelect }),
    getAccountsWithBalance(session.user.id),
    getRecentTransactions(session.user.id, 5),
  ]);
  if (!user) redirect('/login');
  const preference = serializeCurrencyPreference(user);
  const [monthTotals, budgets, allocation, debtSummary] = await Promise.all([
    getDisplayMonthTotals(session.user.id, new Date(), preference),
    getBudgetsWithProgress(session.user.id, new Date(), preference),
    getBucketAllocation(session.user.id, new Date(), preference),
    getDebtSummary(session.user.id, preference),
  ]);

  const totalBalance = accounts.reduce(
    (sum, account) => sum + toNumber(convertMoney(account.balance, account.currency, preference.displayCurrency, preference.usdPerPhp)),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your money at a glance.</p>
      </div>
      <BalanceCards preference={preference} totalBalance={totalBalance} monthTotals={monthTotals} />
      <DebtSummaryCard summary={debtSummary} preference={preference} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentTransactions transactions={recent} />
        </div>
        <div className="min-w-0">
          <AccountSummary accounts={accounts} preference={preference} />
        </div>
      </div>
      <MonthlyBudgetOverview allocation={allocation} preference={preference} />
      <BudgetOverview budgets={budgets} preference={preference} />
    </div>
  );
}
