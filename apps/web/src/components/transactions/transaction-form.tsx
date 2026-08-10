'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { Category } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { categoriesByType } from '@/lib/meta';
import type { SelectAccount } from '@/lib/meta';

const formSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().nullable().optional(),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
      message: 'Amount must be a positive number',
    }),
  type: z.enum(['income', 'expense', 'transfer']),
  date: z.string().min(1, 'Date is required'),
  note: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export interface TransactionFormValues {
  id?: string;
  accountId: string;
  categoryId?: string | null;
  amount: string | number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  note?: string | null;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
  accounts: SelectAccount[];
  categories: Category[];
  initial: TransactionFormValues | null;
}

function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function TransactionForm({
  open,
  onOpenChange,
  onSaved,
  accounts,
  categories,
  initial,
}: TransactionFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      categoryId: null,
      amount: '',
      type: 'expense',
      date: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  const watchType = form.watch('type');

  useEffect(() => {
    if (!open) return;
    form.reset({
      accountId: initial?.accountId ?? accounts[0]?.id ?? '',
      categoryId: initial?.categoryId ?? null,
      amount: String(initial?.amount ?? ''),
      type: initial?.type ?? 'expense',
      date: initial?.date ? toDateInputValue(initial.date) : new Date().toISOString().slice(0, 10),
      note: initial?.note ?? '',
    });
    setSubmitError(null);
  }, [open, initial, accounts, form]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = {
        accountId: values.accountId,
        categoryId: values.categoryId ? values.categoryId : null,
        amount: Number(values.amount),
        type: values.type,
        date: new Date(values.date),
        note: values.note ?? null,
      };
      if (initial?.id) {
        await apiFetch(`/api/transactions/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial?.id ? 'Edit transaction' : 'New transaction'}
          </DialogTitle>
          <DialogDescription>
            Record a manual transaction against one of your accounts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {submitError && (
              <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">
                {submitError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Uncategorized" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {categoriesByType(categories, watchType ?? 'expense').map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional note (e.g. salary, groceries)"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}