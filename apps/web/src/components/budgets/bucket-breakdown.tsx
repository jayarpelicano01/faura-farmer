import type { BucketAllocation } from '@faura-farmer/types';
import { formatMoney, toNumber } from '@/lib/format';
import { BUCKET_META } from '@/lib/meta';
import { cn } from '@/lib/utils';

interface BucketBreakdownProps {
  allocation: BucketAllocation;
  compact?: boolean;
  showUnallocated?: boolean;
}

export function BucketBreakdown({
  allocation,
  compact = false,
  showUnallocated = true,
}: BucketBreakdownProps) {
  const unallocated = toNumber(allocation.unallocated);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {allocation.buckets.map((point) => {
          const meta = BUCKET_META[point.bucket];
          const target = toNumber(point.target);
          const spent = toNumber(point.spent);
          const remaining = toNumber(point.remaining);
          const pct = Math.min(point.progress, 100);
          return (
            <div key={point.bucket} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">{Math.round(point.progress)}%</span>
              </div>
              {!compact && <p className="text-xs text-muted-foreground">{meta.description}</p>}
              <div className="h-2 overflow-hidden rounded-full bg-accent">
                <div
                  className={cn('h-full rounded-full', point.over ? 'bg-expense' : 'bg-income')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatMoney(spent)} of {formatMoney(target)}
                </span>
                <span className={cn(point.over && 'font-medium text-expense')}>
                  {point.over ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(remaining)} left`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showUnallocated && unallocated > 0 && (
        <div className="rounded-lg border border-dashed px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Unallocated spending</span>
            <span className="font-medium">{formatMoney(unallocated)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Spending in expense categories without a needs / wants / savings bucket.
          </p>
        </div>
      )}
    </>
  );
}