'use client';

import { Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatMoney } from '@/lib/format';
import type { RecurringRuleView } from './recurring-form';

export function RecurringReviewQueue({
  items,
  onApprove,
  onSkip,
  pendingId,
}: {
  items: RecurringRuleView[];
  onApprove: (item: RecurringRuleView) => void;
  onSkip: (item: RecurringRuleView) => void;
  pendingId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="due-recurring-heading" className="space-y-3">
      <div>
        <h2 id="due-recurring-heading" className="font-display text-lg font-semibold text-foreground">Ready for review</h2>
        <p className="text-sm text-muted-foreground">Approve or skip one scheduled occurrence at a time.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="border-primary/30">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{item.label || item.category?.name || 'Recurring transaction'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(item.nextDueDate)} · {item.account?.label ?? 'Unknown account'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className={item.type === 'income' ? 'font-semibold text-income' : 'font-semibold text-expense'}>
                  {item.type === 'income' ? '+' : '−'}{formatMoney(item.amount, item.account?.currency ?? 'PHP')}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pendingId === item.id} onClick={() => onSkip(item)} aria-label={`Skip ${item.label || 'recurring transaction'}`}>
                    <SkipForward /> Skip
                  </Button>
                  <Button size="sm" disabled={pendingId === item.id} onClick={() => onApprove(item)} aria-label={`Approve ${item.label || 'recurring transaction'}`}>
                    <Check /> Approve
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
