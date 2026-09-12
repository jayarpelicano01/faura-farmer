import Link from 'next/link';
import { HandCoins, PiggyBank, TriangleAlert, Wallet } from 'lucide-react';
import { formatMoney, toNumber } from '@/lib/format';
import { formatDisplayMoney, type CurrencyPreference, type DebtSummary } from '@faura-farmer/types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionList } from '@/components/transactions/transaction-list';
import { BucketBreakdown } from '@/components/budgets/bucket-breakdown';
import type {
  AccountWithBalance,
  BudgetWithCategory,
  BucketAllocation,
  MonthTotals,
  Transaction,
} from '@faura-farmer/types';

export function MonthlyBudgetOverview({ allocation, preference }: { allocation: BucketAllocation; preference: CurrencyPreference }) {
  const amount = toNumber(allocation.amount);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
          Monthly budget
        </CardTitle>
        <Link href="/budgets" className="text-sm font-medium text-primary hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-display text-2xl font-semibold text-foreground">{formatMoney(amount, preference.displayCurrency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {allocation.persisted
              ? '~50 / 30 / 20 split across needs, wants, and savings.'
              : 'Defaults to this month&apos;s income until you set a value on the budgets page.'}
          </p>
        </div>
        <BucketBreakdown allocation={allocation} displayCurrency={preference.displayCurrency} compact />
      </CardContent>
    </Card>
  );
}

export function BalanceCards({
  totalBalance,
  monthTotals,
  preference,
}: {
  totalBalance: number;
  monthTotals: MonthTotals;
  preference: CurrencyPreference;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Total balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-foreground">
            {formatMoney(totalBalance, preference.displayCurrency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Income this month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-income">
            {formatMoney(toNumber(monthTotals.income), preference.displayCurrency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Expense this month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-expense">
            {formatMoney(toNumber(monthTotals.expense), preference.displayCurrency)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountSummary({ accounts, preference }: { accounts: AccountWithBalance[]; preference: CurrencyPreference }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Accounts</CardTitle>
        <Link href="/accounts" className="text-sm font-medium text-primary hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[345px] overflow-y-auto">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </p>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: account.color ?? '#adb5bd' }}
                >
                  <PiggyBank className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{account.label}</p>
                  <p className="text-xs text-muted-foreground">{account.type}</p>
                </div>
              </div>
              <p className="font-display text-sm font-semibold text-foreground">
                {formatDisplayMoney(account.balance, account.currency, preference)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Recent transactions</CardTitle>
        <Link href="/transactions" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <TransactionList
          transactions={transactions}
          variant="recent"
          emptyMessage="No transactions recorded yet."
        />
      </CardContent>
    </Card>
  );
}

export function BudgetOverview({ budgets, preference }: { budgets: BudgetWithCategory[]; preference: CurrencyPreference }) {
  const top = [...budgets]
    .sort((a, b) => Number(b.over) - Number(a.over) || b.progress - a.progress)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Budgets
        </CardTitle>
        <Link href="/budgets" className="text-sm font-medium text-primary hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No budgets yet. Set a monthly limit on an expense category.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {top.map((budget) => {
              const limit = toNumber(budget.monthlyLimit);
              const spent = toNumber(budget.spent);
              const pct = Math.min(budget.progress, 100);
              return (
                <div
                  key={budget.id}
                  className="space-y-2 rounded-md border border-border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: budget.category.color ?? '#adb5bd' }}
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {budget.category.name}
                      </span>
                    </div>
                    {budget.over && (
                      <TriangleAlert className="h-4 w-4 shrink-0 text-expense" aria-label="Over budget" />
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        budget.over ? 'bg-expense' : 'bg-income',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-foreground">{formatMoney(spent, preference.displayCurrency)}</span>
                    <span className="text-muted-foreground">of {formatMoney(limit, preference.displayCurrency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DebtSummaryCard({ summary, preference }: { summary: DebtSummary; preference: CurrencyPreference }) {
  const empty = summary.owedToYou === '0.00' && summary.youOwe === '0.00';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <HandCoins className="h-4 w-4 text-muted-foreground" />
          Debt position
        </CardTitle>
        <Link href="/debts" className="text-sm font-medium text-primary hover:underline">View debts</Link>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">No debts yet. Track what people owe you and what you owe them.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Owed to you</p><p className="mt-1 font-display text-xl font-semibold text-income">{formatMoney(summary.owedToYou, preference.displayCurrency)}</p></div>
            <div><p className="text-xs text-muted-foreground">You owe</p><p className="mt-1 font-display text-xl font-semibold text-expense">{formatMoney(summary.youOwe, preference.displayCurrency)}</p></div>
            <div><p className="text-xs text-muted-foreground">Net position</p><p className="mt-1 font-display text-xl font-semibold text-foreground">{formatMoney(summary.netPosition, preference.displayCurrency)}</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
