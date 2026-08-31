import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { CategoryComparisonRow, ReportPeriod } from '@faura-farmer/types';
import {
  getAccountSpendingReport,
  getBudgetVarianceReport,
  getCashFlowReport,
  getCategoryComparisonReport,
  getReportCurrencies,
} from '@/lib/queries';
import { getReportRange, parseReportDate, parseReportMonth } from '@/lib/reporting';
import { CashFlowChart } from '@/components/reports/cash-flow-chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoney, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ReportsPageProps {
  searchParams: Promise<{ period?: string; month?: string; end?: string; currency?: string }>;
}

function buildReportHref(period: ReportPeriod, anchor: Date, currency: string) {
  const params = new URLSearchParams({ period, currency });
  if (period === 'week') params.set('end', format(anchor, 'yyyy-MM-dd'));
  else params.set('month', format(anchor, 'yyyy-MM'));
  return `/reports?${params.toString()}`;
}

function signedMoney(value: string, currency: string) {
  const amount = toNumber(value);
  return `${amount > 0 ? '+' : ''}${formatMoney(amount, currency)}`;
}

function percentage(value: number | null) {
  if (value === null) return 'New';
  return `${value > 0 ? '+' : ''}${Math.round(value)}%`;
}

function comparisonTone(row: CategoryComparisonRow) {
  const change = toNumber(row.change);
  if (change > 0) return 'text-expense';
  if (change < 0) return 'text-income';
  return 'text-muted-foreground';
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold text-foreground', className)}>{value}</p>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const period: ReportPeriod = params.period === 'week' ? 'week' : 'month';
  const anchor = period === 'week'
    ? parseReportDate(params.end)
    : parseReportMonth(params.month);
  const currencies = await getReportCurrencies(session.user.id);
  const fallbackCurrency = currencies.includes('PHP') ? 'PHP' : (currencies[0] ?? 'PHP');
  const requestedCurrency = params.currency?.toUpperCase();
  const currency = requestedCurrency && currencies.includes(requestedCurrency)
    ? requestedCurrency
    : fallbackCurrency;
  const range = getReportRange(period, anchor);
  const hasMultipleCurrencies = currencies.length > 1;

  const [cashFlow, budgetVariance, categoryComparison, accountSpending] = await Promise.all([
    getCashFlowReport(session.user.id, currency, range),
    hasMultipleCurrencies
      ? Promise.resolve(null)
      : getBudgetVarianceReport(session.user.id, currency, range),
    getCategoryComparisonReport(session.user.id, currency, range),
    getAccountSpendingReport(session.user.id, currency, range),
  ]);

  const weekHref = buildReportHref('week', period === 'week' ? anchor : range.to, currency);
  const monthHref = buildReportHref('month', anchor, currency);
  const periodField = period === 'week' ? 'end' : 'month';
  const periodValue = period === 'week' ? format(anchor, 'yyyy-MM-dd') : format(anchor, 'yyyy-MM');
  const budgetDescription = period === 'week'
    ? `Month-to-date through ${format(anchor, 'MMMM d, yyyy')}`
    : range.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Budget health, cash flow, spending changes, and account activity.
          </p>
        </div>
        <form action="/reports" method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value={period} />
          <label className="space-y-1 text-sm font-medium text-muted-foreground">
            <span>{period === 'week' ? 'Week ending' : 'Month'}</span>
            <input
              name={periodField}
              type={period === 'week' ? 'date' : 'month'}
              defaultValue={periodValue}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-muted-foreground">
            <span>Currency</span>
            <select
              name="currency"
              defaultValue={currency}
              className="block h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {currencies.length === 0 ? <option value="PHP">PHP</option> : null}
              {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 rounded-md bg-primary-solid px-4 text-sm font-medium text-primary-solid-foreground hover:bg-primary-solid/90"
          >
            Apply
          </button>
        </form>
      </div>

      <div className="inline-flex rounded-md bg-muted p-1 text-sm font-medium">
        <Link
          href={weekHref}
          className={cn(
            'rounded px-3 py-1.5 transition-colors',
            period === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Rolling 7 days
        </Link>
        <Link
          href={monthHref}
          className={cn(
            'rounded px-3 py-1.5 transition-colors',
            period === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Monthly
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Cash flow</CardTitle>
          <CardDescription>{range.label} · {currency}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Income" value={formatMoney(cashFlow.summary.income, currency)} className="text-income" />
            <Metric label="Expenses" value={formatMoney(cashFlow.summary.expense, currency)} className="text-expense" />
            <Metric
              label="Net cash flow"
              value={signedMoney(cashFlow.summary.net, currency)}
              className={toNumber(cashFlow.summary.net) < 0 ? 'text-expense' : 'text-income'}
            />
            <Metric
              label="Savings rate"
              value={cashFlow.summary.savingsRate === null ? '—' : `${Math.round(cashFlow.summary.savingsRate)}%`}
            />
          </div>
          <CashFlowChart data={cashFlow.points} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Budget vs actual</CardTitle>
          <CardDescription>{budgetDescription} · Uses current budget settings</CardDescription>
        </CardHeader>
        <CardContent>
          {hasMultipleCurrencies ? (
            <p className="py-6 text-sm text-muted-foreground">
              Budget limits are not assigned to a currency. Add budget-currency support before comparing a shared limit against one currency&apos;s spending.
            </p>
          ) : !budgetVariance || budgetVariance.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No budget limits or expenses recorded for this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetVariance.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {row.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /> : null}
                        {row.categoryName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.kind === 'budget' ? formatMoney(row.limit, currency) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(row.spent, currency)}</TableCell>
                    <TableCell className={cn('text-right font-medium', row.over ? 'text-expense' : 'text-income')}>
                      {row.over ? `${formatMoney(Math.abs(toNumber(row.remaining)), currency)} over` : `${formatMoney(row.remaining, currency)} left`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Spending comparison</CardTitle>
            <CardDescription>{range.label} compared with {range.comparisonLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryComparison.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No expenses recorded in either period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryComparison.map((row) => (
                    <TableRow key={row.categoryName}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {row.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /> : null}
                          {row.categoryName}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(row.current, currency)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatMoney(row.previous, currency)}</TableCell>
                      <TableCell className={cn('text-right font-medium', comparisonTone(row))}>
                        <span className="block">{signedMoney(row.change, currency)}</span>
                        <span className="text-xs">{percentage(row.percentageChange)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Spending by account</CardTitle>
            <CardDescription>Expenses by payment account for {range.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {accountSpending.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No expenses recorded for this period.</p>
            ) : (
              <div className="space-y-4">
                {accountSpending.map((account) => (
                  <div key={account.accountId} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        {account.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.color }} /> : null}
                        <span className="truncate">{account.accountName}</span>
                        {account.isArchived ? <span className="text-xs font-normal text-muted-foreground">Archived</span> : null}
                      </span>
                      <span className="shrink-0">{formatMoney(account.amount, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-accent">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(account.share, 100)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{Math.round(account.share)}% of expenses · {account.accountType.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
