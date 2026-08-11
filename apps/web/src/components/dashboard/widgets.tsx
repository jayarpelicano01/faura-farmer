import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, CirclePlus, PieChart, PiggyBank } from 'lucide-react';
import { formatMoney, formatDate, toNumber } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions recorded yet.</p>
        ) : (
          <Table className="min-w-[480px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    {tx.account?.label}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {tx.category?.name ?? '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={tx.type === 'income' ? 'income' : tx.type === 'expense' ? 'expense' : 'muted'}>
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={
                      tx.type === 'income'
                        ? 'text-right font-semibold text-income'
                        : tx.type === 'expense'
                          ? 'text-right font-semibold text-expense'
                          : 'text-right font-semibold text-foreground'
                    }
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                    {formatMoney(tx.amount, tx.account?.currency ?? 'PHP')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function QuickActions() {
  const actions = [
    { href: '/transactions?new=1', label: 'Add transaction', icon: ArrowUpFromLine },
    { href: '/accounts?new=1', label: 'Add account', icon: CirclePlus },
    { href: '/categories?new=1', label: 'Add category', icon: PieChart },
    { href: '/transactions', label: 'Log income', icon: ArrowUpFromLine },
    { href: '/transactions?type=expense', label: 'Log expense', icon: ArrowDownToLine },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <action.icon className="h-4 w-4 text-primary" />
            {action.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}