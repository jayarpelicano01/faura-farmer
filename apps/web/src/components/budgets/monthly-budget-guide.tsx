'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Pencil, TriangleAlert } from 'lucide-react';
import type { BucketAllocation, BudgetWithCategory, DisplayCurrency } from '@faura-farmer/types';
import { monthlyBudgetSchema, type MonthlyBudgetInput } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { formatMoney as formatProjectedMoney, toNumber } from '@/lib/format';
import { useDisplayCurrency } from '@/components/currency/display-currency-provider';
import { BucketBreakdown } from './bucket-breakdown';

interface MonthlyBudgetGuideProps {
  budgets: BudgetWithCategory[];
}

type DisplayBucketAllocation = BucketAllocation & { displayCurrency: DisplayCurrency };

export function MonthlyBudgetGuide({ budgets }: MonthlyBudgetGuideProps) {
  const { displayCurrency, formatMoney, usdPerPhp } = useDisplayCurrency();
  const [allocation, setAllocation] = useState<DisplayBucketAllocation | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<MonthlyBudgetInput>({
    resolver: zodResolver(monthlyBudgetSchema),
    defaultValues: { amount: undefined },
  });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<DisplayBucketAllocation>('/api/budgets/monthly?display=1');
      setAllocation(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load the monthly budget');
    }
  }, [displayCurrency, usdPerPhp]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editOpen) {
      form.reset({ amount: toNumber(allocation?.amount) || undefined });
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, allocation, form]);

  async function onSubmit(values: MonthlyBudgetInput) {
    setSaving(true);
    setSubmitError(null);
    try {
      const data = await apiFetch<DisplayBucketAllocation>('/api/budgets/monthly?display=1', {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      setAllocation(data);
      setEditOpen(false);
      toast.success('Monthly budget updated');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save monthly budget');
    } finally {
      setSaving(false);
    }
  }

  const amount = toNumber(allocation?.amount);
  const limitsTotal = useMemo(
    () => budgets.reduce((sum, b) => sum + toNumber(b.monthlyLimit), 0),
    [budgets],
  );
  const limitsOver = allocation && limitsTotal > amount;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="font-display text-lg">Monthly budget</CardTitle>
          <CardDescription>
            50 / 30 / 20 split of your monthly budget across needs, wants, and savings.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Edit monthly budget">
          <Pencil className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="font-display text-3xl font-semibold">
            {allocation ? formatProjectedMoney(amount, allocation.displayCurrency) : '—'}
          </div>
          {allocation && (
            <p className="mt-1 text-xs text-muted-foreground">
              {allocation.persisted
                ? 'Your target household budget for each month.'
                : 'Defaults to this month&apos;s income until you set a value.'}
            </p>
          )}
        </div>

        {allocation && (
          <BucketBreakdown allocation={allocation} displayCurrency={allocation.displayCurrency} />
        )}

        {limitsOver && (
          <div className="flex items-start gap-2 rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your per-category budget limits total {formatMoney(limitsTotal)}, which is more than your monthly
              budget of {formatMoney(amount)}. Consider raising your monthly budget or trimming category limits.
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Monthly budget</DialogTitle>
            <DialogDescription>
              Set a recurring budget. The 50 / 30 / 20 split is calculated from this amount.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {submitError && (
                <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{submitError}</p>
              )}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ({displayCurrency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        placeholder="e.g. 30000"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
