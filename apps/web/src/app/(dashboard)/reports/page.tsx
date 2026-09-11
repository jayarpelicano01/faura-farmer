import Link from 'next/link';
import { prisma } from '@faura-farmer/database';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import type { CategoryComparisonRow, ReportPeriod } from '@faura-farmer/types';
import { formatDisplayMoney } from '@faura-farmer/types';
import { getBalanceTimeline, getBudgetVarianceReport, getCategoryComparisonReport, getCategorySpendingReport, type BalanceTimelinePeriod } from '@/lib/queries';
import { currencyPreferenceSelect, serializeCurrencyPreference } from '@/lib/currency-preference';
import { getReportRange, parseReportDate, parseReportMonth } from '@/lib/reporting';
import { BalanceMovementChart, CategorySpendingChart } from '@/components/reports/report-charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toNumber } from '@/lib/format';

interface ReportsPageProps { searchParams: Promise<{ period?: string; month?: string; end?: string; account?: string; timeline?: string }>; }
function reportHref(params: Record<string, string>) { return `/reports?${new URLSearchParams(params).toString()}`; }
function signedMoney(value: string, preference: ReturnType<typeof serializeCurrencyPreference>) { return `${toNumber(value) > 0 ? '+' : ''}${formatDisplayMoney(value, preference.displayCurrency, preference)}`; }
function percentage(value: number | null) { return value === null ? 'New' : `${value > 0 ? '+' : ''}${Math.round(value)}%`; }
function comparisonTone(row: CategoryComparisonRow) { const change = toNumber(row.change); return change > 0 ? 'text-expense' : change < 0 ? 'text-income' : 'text-muted-foreground'; }

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const params = await searchParams;
  const period: ReportPeriod = params.period === 'week' ? 'week' : 'month';
  const anchor = period === 'week' ? parseReportDate(params.end) : parseReportMonth(params.month);
  const range = getReportRange(period, anchor);
  const timelinePeriod: BalanceTimelinePeriod = params.timeline === '30d' || params.timeline === '365d' ? params.timeline : '7d';
  const [user, accounts, transactionCount, budgetCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: currencyPreferenceSelect }),
    prisma.account.findMany({ where: { userId: session.user.id }, select: { id: true, label: true, isArchived: true }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.count({ where: { userId: session.user.id } }),
    prisma.budget.count({ where: { userId: session.user.id } }),
  ]);
  if (!user) redirect('/login');
  const preference = serializeCurrencyPreference(user);
  const selectedAccountId = params.account && accounts.some((account) => account.id === params.account) ? params.account : undefined;
  const baseParams = { period, ...(period === 'week' ? { end: format(anchor, 'yyyy-MM-dd') } : { month: format(anchor, 'yyyy-MM') }), ...(selectedAccountId ? { account: selectedAccountId } : { account: 'all' }) };
  const [timeline, categorySpending, budgetVariance, categoryComparison] = await Promise.all([
    getBalanceTimeline(session.user.id, preference, timelinePeriod, selectedAccountId),
    getCategorySpendingReport(session.user.id, preference, range, selectedAccountId),
    getBudgetVarianceReport(session.user.id, preference, range),
    getCategoryComparisonReport(session.user.id, preference, range),
  ]);
  const hasTransactions = transactionCount > 0;
  const scopeLabel = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId)?.label ?? 'Selected account' : 'All accounts';

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Reports</h1><p className="mt-1 text-sm text-muted-foreground">Balance movement and spending insights across your accounts.</p></div>
      <form action="/reports" method="get" className="flex flex-wrap items-end gap-2"><input type="hidden" name="period" value={period} /><input type="hidden" name="timeline" value={timelinePeriod} />{period === 'week' ? <input type="hidden" name="end" value={format(anchor, 'yyyy-MM-dd')} /> : <input type="hidden" name="month" value={format(anchor, 'yyyy-MM')} />}<label className="space-y-1 text-sm font-medium text-muted-foreground"><span>Account</span><select name="account" defaultValue={selectedAccountId ?? 'all'} className="block h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="all">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}{account.isArchived ? ' (archived)' : ''}</option>)}</select></label><button type="submit" className="h-10 rounded-md bg-primary-solid px-4 text-sm font-medium text-primary-solid-foreground hover:bg-primary-solid/90">Apply</button></form>
    </div>
    {!hasTransactions ? <Card><CardContent className="py-8 text-sm text-muted-foreground">Add transactions to see reports.</CardContent></Card> : <>
      <Card><CardHeader><CardTitle className="font-display text-lg">Balance movement</CardTitle><CardDescription>{scopeLabel} · shown in {preference.displayCurrency}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="inline-flex rounded-md bg-muted p-1 text-sm font-medium">{(['7d', '30d', '365d'] as const).map((value) => <Link key={value} href={reportHref({ ...baseParams, timeline: value })} className={cn('rounded px-3 py-1.5 transition-colors', timelinePeriod === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{value === '7d' ? 'Past 7 days' : value === '30d' ? 'Past 30 days' : 'Past year'}</Link>)}</div><BalanceMovementChart data={timeline} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="font-display text-lg">Spending by category</CardTitle><CardDescription>{scopeLabel} expenses for {range.label}</CardDescription></CardHeader><CardContent><CategorySpendingChart data={categorySpending} /></CardContent></Card>
      <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All accounts</span><div className="h-px flex-1 bg-border" /></div>
      <div className="flex flex-wrap items-end justify-between gap-3"><div className="inline-flex rounded-md bg-muted p-1 text-sm font-medium"><Link href={reportHref({ ...baseParams, period: 'week', end: format(period === 'week' ? anchor : new Date(), 'yyyy-MM-dd') })} className={cn('rounded px-3 py-1.5', period === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Week</Link><Link href={reportHref({ ...baseParams, period: 'month', month: format(anchor, 'yyyy-MM') })} className={cn('rounded px-3 py-1.5', period === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Month</Link></div><form action="/reports" method="get" className="flex items-end gap-2"><input type="hidden" name="account" value={selectedAccountId ?? 'all'} /><input type="hidden" name="timeline" value={timelinePeriod} /><input type="hidden" name="period" value={period} /><input name={period === 'week' ? 'end' : 'month'} type={period === 'week' ? 'date' : 'month'} defaultValue={format(anchor, period === 'week' ? 'yyyy-MM-dd' : 'yyyy-MM')} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" /><button type="submit" className="h-10 rounded-md border border-input px-4 text-sm font-medium">Apply</button></form></div>
      <Card><CardHeader><CardTitle className="font-display text-lg">Budget vs actual</CardTitle><CardDescription>{period === 'week' ? `Month-to-date through ${format(anchor, 'MMMM d, yyyy')}` : range.label} · All accounts</CardDescription></CardHeader><CardContent>{budgetCount === 0 ? <p className="py-6 text-sm text-muted-foreground">No budgets set.</p> : <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader><TableBody>{budgetVariance.map((row) => <TableRow key={row.id}><TableCell className="font-medium"><span className="flex items-center gap-2">{row.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /> : null}{row.categoryName}</span></TableCell><TableCell className="text-right text-muted-foreground">{row.kind === 'budget' ? formatDisplayMoney(row.limit, preference.displayCurrency, preference) : '-'}</TableCell><TableCell className="text-right">{formatDisplayMoney(row.spent, preference.displayCurrency, preference)}</TableCell><TableCell className={cn('text-right font-medium', row.over ? 'text-expense' : 'text-income')}>{row.over ? `${formatDisplayMoney(String(Math.abs(toNumber(row.remaining))), preference.displayCurrency, preference)} over` : `${formatDisplayMoney(row.remaining, preference.displayCurrency, preference)} left`}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="font-display text-lg">Spending comparison</CardTitle><CardDescription>{range.label} compared with {range.comparisonLabel} · All accounts</CardDescription></CardHeader><CardContent>{categoryComparison.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No transactions to compare.</p> : <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Current</TableHead><TableHead className="text-right">Previous</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader><TableBody>{categoryComparison.map((row) => <TableRow key={row.categoryName}><TableCell className="font-medium"><span className="flex items-center gap-2">{row.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /> : null}{row.categoryName}</span></TableCell><TableCell className="text-right">{formatDisplayMoney(row.current, preference.displayCurrency, preference)}</TableCell><TableCell className="text-right text-muted-foreground">{formatDisplayMoney(row.previous, preference.displayCurrency, preference)}</TableCell><TableCell className={cn('text-right font-medium', comparisonTone(row))}><span className="block">{signedMoney(row.change, preference)}</span><span className="text-xs">{percentage(row.percentageChange)}</span></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
    </>}
  </div>;
}
