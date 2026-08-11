import Link from 'next/link';
import { PiggyBank } from 'lucide-react';
import { formatMoney, toNumber } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionList } from '@/components/transactions/transaction-list';
import type { AccountWithBalance, MonthTotals, Transaction } from '@faura-farmer/types';

export function BalanceCards({
  totalBalance,
  monthTotals,
}: {
  totalBalance: number;
  monthTotals: MonthTotals;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Total balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-foreground">
            {formatMoney(totalBalance)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Income this month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-income">
            {formatMoney(toNumber(monthTotals.income))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-sm text-muted-foreground">Expense this month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold text-expense">
            {formatMoney(toNumber(monthTotals.expense))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountSummary({ accounts }: { accounts: AccountWithBalance[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">Accounts</CardTitle>
        <Link href="/accounts" className="text-sm font-medium text-primary hover:underline">
          Manage
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
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
                {formatMoney(account.balance, account.currency)}
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