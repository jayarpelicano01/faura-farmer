import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { getMonthlyTrend, getSpendingByCategory } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const SpendingBarChart = dynamic(() =>
  import('@/components/reports/spending-bar-chart').then((m) => m.SpendingBarChart),
);
const TrendLineChart = dynamic(() =>
  import('@/components/reports/trend-line-chart').then((m) => m.TrendLineChart),
);

interface ReportsPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { month } = await searchParams;
  let selectedMonth = new Date();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const parsed = new Date(`${month}-01T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) selectedMonth = parsed;
  }

  const [spending, trend] = await Promise.all([
    getSpendingByCategory(session.user.id, selectedMonth),
    getMonthlyTrend(session.user.id, 6),
  ]);

  const monthValue = format(selectedMonth, 'yyyy-MM');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spending by category and your last six months of income vs expenses.
          </p>
        </div>
        <form action="/reports" method="get" className="flex items-center gap-2">
          <label htmlFor="month" className="text-sm font-medium text-muted-foreground">
            Month
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={monthValue}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Spending by category</CardTitle>
          <CardDescription>{format(selectedMonth, 'MMMM yyyy')}</CardDescription>
        </CardHeader>
        <CardContent>
          {spending.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No expenses recorded for this month yet.
            </p>
          ) : (
            <SpendingBarChart data={spending} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Monthly trend</CardTitle>
          <CardDescription>Income vs expenses, last six months</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendLineChart data={trend} />
        </CardContent>
      </Card>
    </div>
  );
}