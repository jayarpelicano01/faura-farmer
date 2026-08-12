'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { BudgetWithCategory, Category } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { formatMoney, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { BudgetForm, type BudgetFormValues } from './budget-form';
import { MonthlyBudgetGuide } from './monthly-budget-guide';

export function BudgetsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [budgets, setBudgets] = useState<BudgetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<BudgetFormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BudgetWithCategory | null>(null);

  const newParam = searchParams.get('new');

  useEffect(() => {
    if (newParam === '1') {
      setEditing(null);
      setDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam]);

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open && newParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      const qs = params.toString();
      router.replace(qs ? `/budgets?${qs}` : '/budgets', { scroll: false });
    }
  }

  const load = useCallback(async () => {
    try {
      const [budgetData, categoryData] = await Promise.all([
        apiFetch<BudgetWithCategory[]>('/api/budgets'),
        apiFetch<{ income: Category[]; expense: Category[] }>('/api/categories'),
      ]);
      setBudgets(budgetData);
      setCategories(categoryData.expense);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(budget: BudgetWithCategory) {
    setEditing({ id: budget.id, categoryId: budget.categoryId, monthlyLimit: budget.monthlyLimit });
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await apiFetch(`/api/budgets/${pendingDelete.id}`, { method: 'DELETE' });
      toast.success('Budget deleted');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete budget');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Budgets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan your household spending with a 50 / 30 / 20 budget and per-category monthly limits.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New budget
        </Button>
      </div>

      <MonthlyBudgetGuide budgets={budgets} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No budgets yet. Set a monthly limit on an expense category to start tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => {
            const limit = toNumber(budget.monthlyLimit);
            const spent = toNumber(budget.spent);
            const remaining = toNumber(budget.remaining);
            const pct = Math.min(budget.progress, 100);
            return (
              <Card key={budget.id} className={cn(budget.over && 'border-expense/60')}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: budget.category.color ?? '#adb5bd' }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {budget.category.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate font-display text-base">
                        {budget.category.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {formatMoney(spent)} of {formatMoney(limit)} spent
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(budget)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-expense"
                      onClick={() => setPendingDelete(budget)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-accent">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        budget.over ? 'bg-expense' : 'bg-income',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{Math.round(budget.progress)}% used</span>
                    <span>{budget.over ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(remaining)} left`}</span>
                  </div>
                  {budget.over && (
                    <Badge variant="destructive" className="gap-1">
                      <TriangleAlert className="h-3 w-3" />
                      Over budget
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete budget"
        description={
          pendingDelete
            ? `Delete the monthly budget for "${pendingDelete.category.name}"? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

      <BudgetForm
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSaved={load}
        initial={editing}
        expenseCategories={categories}
      />
    </div>
  );
}