import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getAccountsWithBalance,
  getMonthTotals,
  getRecentTransactions,
} from '@/lib/queries';
import { toNumber } from '@/lib/format';
import {
  AccountSummary,
  BalanceCards,
  QuickActions,
  RecentTransactions,
} from '@/components/dashboard/widgets';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [accounts, monthTotals, recent] = await Promise.all([
    getAccountsWithBalance(session.user.id),
    getMonthTotals(session.user.id, new Date()),
    getRecentTransactions(session.user.id, 8),
  ]);

  const totalBalance = accounts.reduce((sum, account) => sum + toNumber(account.balance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your money at a glance.</p>
      </div>
      <BalanceCards totalBalance={totalBalance} monthTotals={monthTotals} />
      <QuickActions />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentTransactions transactions={recent} />
        </div>
        <div className="min-w-0">
          <AccountSummary accounts={accounts} />
        </div>
      </div>
    </div>
  );
}