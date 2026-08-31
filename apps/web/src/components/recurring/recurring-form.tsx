'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Account, Category, Frequency, RecurringRule } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';

export type RecurringRuleView = Omit<RecurringRule, 'nextDueDate'> & {
  nextDueDate: string | Date;
  account?: Pick<Account, 'id' | 'label' | 'currency'>;
  category?: Category | null;
};

type FormState = {
  label: string;
  accountId: string;
  categoryId: string;
  amount: string;
  type: 'income' | 'expense';
  frequency: Frequency;
  nextDueDate: string;
};

function toDateInput(value: string | Date | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function initialState(rule: RecurringRuleView | null, accounts: Account[]): FormState {
  return {
    label: rule?.label ?? '',
    accountId: rule?.accountId ?? accounts.find((account) => !account.isArchived)?.id ?? '',
    categoryId: rule?.categoryId ?? '',
    amount: rule ? String(rule.amount) : '',
    type: rule?.type ?? 'expense',
    frequency: rule?.frequency ?? 'monthly',
    nextDueDate: toDateInput(rule?.nextDueDate),
  };
}

export function RecurringForm({
  open,
  onOpenChange,
  accounts,
  categories,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  initial: RecurringRuleView | null;
  onSaved: () => void | Promise<void>;
}) {
  const [values, setValues] = useState<FormState>(() => initialState(initial, accounts));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === values.type),
    [categories, values.type],
  );

  useEffect(() => {
    if (!open) return;
    setValues(initialState(initial, accounts));
    setError(null);
  }, [open, initial, accounts]);

  useEffect(() => {
    if (!values.categoryId) return;
    if (!availableCategories.some((category) => category.id === values.categoryId)) {
      setValues((current) => ({ ...current, categoryId: '' }));
    }
  }, [availableCategories, values.categoryId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.accountId || !values.amount || !values.nextDueDate) {
      setError('Account, amount, and next due date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: values.label || null,
        accountId: values.accountId,
        categoryId: values.categoryId || null,
        amount: Number(values.amount),
        type: values.type,
        frequency: values.frequency,
        nextDueDate: new Date(`${values.nextDueDate}T00:00:00.000Z`),
      };
      await apiFetch(initial?.id ? `/api/recurring-rules/${initial.id}` : '/api/recurring-rules', {
        method: initial?.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(initial?.id ? 'Recurring rule updated' : 'Recurring rule created');
      onOpenChange(false);
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save recurring rule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{initial ? 'Edit recurring rule' : 'New recurring rule'}</DialogTitle>
          <DialogDescription>Create income or expense occurrences for review before they affect your ledger.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          {error && <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-label">Label</Label>
              <Input id="recurring-label" value={values.label} onChange={(event) => set('label', event.target.value)} placeholder="e.g. Rent" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={values.type} onValueChange={(value) => set('type', value as FormState['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={values.accountId} onValueChange={(value) => set('accountId', value)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((account) => !account.isArchived || account.id === initial?.accountId).map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.label} ({account.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={values.categoryId || 'none'} onValueChange={(value) => set('categoryId', value === 'none' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {availableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-amount">Amount</Label>
              <Input id="recurring-amount" type="number" min="0.01" max="999999999999" step="0.01" value={values.amount} onChange={(event) => set('amount', event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={values.frequency} onValueChange={(value) => set('frequency', value as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-due">Next due date</Label>
              <Input id="recurring-due" type="date" value={values.nextDueDate} onChange={(event) => set('nextDueDate', event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Create rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
