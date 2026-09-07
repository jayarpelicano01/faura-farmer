'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { BUDGET_BUCKETS, type BudgetBucket, type Category } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectItemText, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { useDisplayCurrency } from '@/components/currency/display-currency-provider';
import { categoriesByType, BUCKET_BADGE_COLOR, BUCKET_META, resolveCategoryBucket } from '@/lib/meta';
import type { SelectAccount } from '@/lib/meta';

const formSchema = z
  .object({
    accountId: z.string().min(1, 'Account is required'),
    destinationAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    bucket: z.enum(BUDGET_BUCKETS).nullable().optional(),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
        message: 'Amount must be a positive number',
      }),
    type: z.enum(['income', 'expense', 'transfer']),
    date: z.string().min(1, 'Date is required'),
    note: z.string().optional().nullable(),
  })
  .superRefine((values, context) => {
    if (values.type !== 'transfer') return;

    if (!values.destinationAccountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccountId'],
        message: 'To account is required',
      });
    } else if (values.destinationAccountId === values.accountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationAccountId'],
        message: 'Choose a different account',
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export interface TransactionFormValues {
  id?: string;
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  bucket?: BudgetBucket | null;
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
  const { convert, displayCurrency } = useDisplayCurrency();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdTransactionId, setCreatedTransactionId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      destinationAccountId: null,
      categoryId: null,
      bucket: null,
      amount: '',
      type: 'expense',
      date: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  const watchType = form.watch('type');
  const watchAccountId = form.watch('accountId');
  const watchDestinationAccountId = form.watch('destinationAccountId');
  const watchCategoryId = form.watch('categoryId');

  const sourceAccount = useMemo(
    () => accounts.find((account) => account.id === watchAccountId) ?? null,
    [accounts, watchAccountId],
  );
  const destinationAccounts = useMemo(() => {
    if (!sourceAccount) return [];
    const sourceCurrency = sourceAccount.currency.toUpperCase();
    return accounts.filter(
      (account) =>
        account.id !== sourceAccount.id && account.currency.toUpperCase() === sourceCurrency,
    );
  }, [accounts, sourceAccount]);

  useEffect(() => {
    if (!open) return;
    form.reset({
      accountId: initial?.accountId ?? accounts[0]?.id ?? '',
      destinationAccountId: initial?.destinationAccountId ?? null,
      categoryId: initial?.categoryId ?? null,
      bucket: initial?.bucket ?? null,
      amount: String(initial?.amount ?? ''),
      type: initial?.type ?? 'expense',
      date: initial?.date ? toDateInputValue(initial.date) : new Date().toISOString().slice(0, 10),
      note: initial?.note ?? '',
    });
    setSubmitError(null);
    setCreatedTransactionId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, form]);

  useEffect(() => {
    if (watchType === 'transfer') {
      form.setValue('categoryId', null);
      form.setValue('bucket', null);
      return;
    }

    form.setValue('destinationAccountId', null);
    if (watchType !== 'expense') form.setValue('bucket', null);
  }, [watchType, form]);

  useEffect(() => {
    if (watchType !== 'transfer' || !watchDestinationAccountId) return;
    if (destinationAccounts.some((account) => account.id === watchDestinationAccountId)) return;

    form.setValue('destinationAccountId', null, { shouldValidate: true });
  }, [destinationAccounts, form, watchDestinationAccountId, watchType]);

  async function onSubmit(values: FormValues) {
    if (createdTransactionId) return;
    if (values.type === 'transfer') {
      const source = accounts.find((account) => account.id === values.accountId);
      const destination = accounts.find(
        (account) => account.id === values.destinationAccountId,
      );
      if (
        !source ||
        !destination ||
        source.id === destination.id ||
        source.currency.toUpperCase() !== destination.currency.toUpperCase()
      ) {
        form.setError('destinationAccountId', {
          message: 'Choose a different account with the same currency',
        });
        return;
      }
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const payload = {
        accountId: values.accountId,
        ...(values.type === 'transfer'
          ? { destinationAccountId: values.destinationAccountId }
          : {
              categoryId: values.categoryId || null,
              bucket: values.type === 'expense' ? values.bucket ?? null : null,
            }),
        amount: Number(
          convert(
            values.amount,
            displayCurrency,
            accounts.find((account) => account.id === values.accountId)?.currency ?? 'PHP',
          ),
        ),
        type: values.type,
        date: new Date(values.date),
        note: values.note ?? null,
      };
      if (initial?.id) {
        await apiFetch(`/api/transactions/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(values.type === 'transfer' ? 'Transfer updated' : 'Transaction updated');
      } else {
        const created = await apiFetch<{ id: string }>('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(values.type === 'transfer' ? 'Transfer added' : 'Transaction added');
        setCreatedTransactionId(created.id);
        await onSaved();
        return;
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
            {initial?.id
              ? watchType === 'transfer'
                ? 'Edit transfer'
                : 'Edit transaction'
              : watchType === 'transfer'
                ? 'New transfer'
                : 'New transaction'}
          </DialogTitle>
          <DialogDescription>
            {watchType === 'transfer'
              ? 'Move money between two accounts with the same currency.'
              : 'Record a manual transaction against one of your accounts.'}
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
                  <FormLabel>{watchType === 'transfer' ? 'From account' : 'Account'}</FormLabel>
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
            {watchType === 'transfer' && (
              <FormField
                control={form.control}
                name="destinationAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To account</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        disabled={!sourceAccount || destinationAccounts.length === 0}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select destination account" />
                        </SelectTrigger>
                        <SelectContent>
                          {destinationAccounts.length === 0 ? (
                            <SelectItem value="__unavailable" disabled>
                              No compatible accounts
                            </SelectItem>
                          ) : (
                            destinationAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {!sourceAccount
                        ? 'Choose a source account to see destinations.'
                        : destinationAccounts.length === 0
                          ? `No other ${sourceAccount.currency} account is available.`
                          : `Only ${sourceAccount.currency} accounts are available.`}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {watchType !== 'transfer' && (
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
                          {categoriesByType(categories, watchType ?? 'expense').map((category) => {
                            const bucket = resolveCategoryBucket(categories, category);
                            return (
                              <SelectItem key={category.id} value={category.id}>
                                <SelectItemText>{category.name}</SelectItemText>
                                {bucket && (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {BUCKET_META[bucket].label}
                                  </span>
                                )}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(watchType ?? 'expense') === 'expense' && (
              <FormField
                control={form.control}
                name="bucket"
                render={({ field }) => {
                  const selectedCategory = categories.find((c) => c.id === watchCategoryId);
                  const autoBucket = selectedCategory
                    ? resolveCategoryBucket(categories, selectedCategory)
                    : null;
                  return (
                    <FormItem>
                      <FormLabel>50 / 30 / 20 bucket</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? 'auto'}
                          onValueChange={(value) => field.onChange(value === 'auto' ? null : value)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Auto (from category)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">
                              <span
                                className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: autoBucket
                                    ? BUCKET_BADGE_COLOR[autoBucket]
                                    : 'transparent',
                                }}
                              />
                              <SelectItemText>
                                {autoBucket ? `Auto (${BUCKET_META[autoBucket].label})` : 'Auto (from category)'}
                              </SelectItemText>
                            </SelectItem>
                            {BUDGET_BUCKETS.map((bucket) => (
                              <SelectItem key={bucket} value={bucket}>
                                <span
                                  className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: BUCKET_BADGE_COLOR[bucket] }}
                                />
                                <SelectItemText>{BUCKET_META[bucket].label}</SelectItemText>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
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
                {createdTransactionId ? 'Done' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                disabled={saving || Boolean(createdTransactionId) || (watchType === 'transfer' && destinationAccounts.length === 0)}
              >
                {saving
                  ? 'Saving…'
                  : createdTransactionId
                    ? 'Transaction added'
                  : initial?.id
                    ? 'Save changes'
                    : watchType === 'transfer'
                      ? 'Add transfer'
                      : 'Add transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
