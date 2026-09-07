'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createAccountSchema, type CreateAccountInput } from '@/lib/validations';
import { ACCOUNT_TYPES } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import { apiFetch } from '@/lib/api';
import { useDisplayCurrency } from '@/components/currency/display-currency-provider';

export interface AccountFormValues {
  id?: string;
  label: string;
  type: (typeof ACCOUNT_TYPES)[number];
  currency: string;
  startingBalance: string | number;
  currentBalance?: string | number;
  color?: string | null;
}

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
  initial: AccountFormValues | null;
}

const ACCOUNT_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  bank: 'Bank',
  e_wallet: 'E-wallet',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

export function AccountForm({ open, onOpenChange, onSaved, initial }: AccountFormProps) {
  const { convert, displayCurrency } = useDisplayCurrency();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentBalance, setCurrentBalance] = useState('');

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      label: '',
      type: 'bank',
      currency: 'PHP',
      startingBalance: 0,
      color: '#adb5bd',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      label: initial?.label ?? '',
      type: (initial?.type as CreateAccountInput['type']) ?? 'bank',
      currency: initial?.currency ?? 'PHP',
      startingBalance: Number(initial ? convert(initial.startingBalance, initial.currency) : 0),
      color: initial?.color ?? '#adb5bd',
    });
    setCurrentBalance(initial?.id ? convert(initial.currentBalance ?? initial.startingBalance, initial.currency) : '');
    setSubmitError(null);
  }, [convert, open, initial, form]);

  async function onSubmit(values: CreateAccountInput) {
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = {
        ...values,
        startingBalance: Number(convert(values.startingBalance, displayCurrency, values.currency)),
      };
      if (initial?.id) {
        await apiFetch(`/api/accounts/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            ...(currentBalance.trim() === '' ? {} : { currentBalance: Number(convert(currentBalance, displayCurrency, values.currency)) }),
          }),
        });
        toast.success('Account updated');
      } else {
        await apiFetch('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Account created');
      }
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial?.id ? 'Edit account' : 'New account'}
          </DialogTitle>
          <DialogDescription>
            Label it whatever you like — e.g. GCash, Maribank Save Up, or Cash wallet.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {submitError && (
              <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">
                {submitError}
              </p>
            )}
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. GCash, Cash wallet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {ACCOUNT_LABELS[type]}
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="startingBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting balance ({displayCurrency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        value={field.value ?? 0}
                        onChange={(event) => {
                          const next = event.target.value === '' ? '' : Number(event.target.value);
                          if (initial?.id && currentBalance !== '' && typeof next === 'number' && Number.isFinite(next)) {
                            setCurrentBalance(String(Number(currentBalance) + next - Number(field.value ?? 0)));
                          }
                          field.onChange(next);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {initial?.id ? (
                <div className="space-y-2">
                  <FormLabel>Current balance ({displayCurrency})</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={currentBalance}
                    onChange={(event) => setCurrentBalance(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Saving a changed value adds a balance adjustment to your transaction history.</p>
                </div>
              ) : null}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <ColorPicker value={field.value ?? '#adb5bd'} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add account'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
