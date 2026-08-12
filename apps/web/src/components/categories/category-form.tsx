'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { createCategorySchema, type CreateCategoryInput } from '@/lib/validations';
import { BUDGET_BUCKETS, CATEGORY_TYPES, type CategoryType } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import { apiFetch } from '@/lib/api';

export interface CategoryFormValues {
  id?: string;
  name: string;
  type: CategoryType;
  parentId?: string | null;
  color?: string | null;
  bucket?: string | null;
}

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
  initial: CategoryFormValues | null;
  parents: Array<{ id: string; name: string; type: CategoryType }>;
}

export function CategoryForm({ open, onOpenChange, onSaved, initial, parents }: CategoryFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: '',
      type: 'expense',
      parentId: null,
      color: '#adb5bd',
      bucket: null,
    },
  });

  const watchType = form.watch('type');

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initial?.name ?? '',
      type: (initial?.type as CreateCategoryInput['type']) ?? 'expense',
      parentId: initial?.parentId ?? null,
      color: initial?.color ?? '#adb5bd',
      bucket: (initial?.bucket as CreateCategoryInput['bucket']) ?? null,
    });
    setSubmitError(null);
  }, [open, initial, form]);

  const availableParents = parents.filter((p) => p.id !== initial?.id && p.type === watchType);

  async function onSubmit(values: CreateCategoryInput) {
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = { ...values, parentId: values.parentId ? values.parentId : null };
      if (initial?.id) {
        await apiFetch(`/api/categories/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Category updated');
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Category created');
      }
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial?.id ? 'Edit category' : 'New category'}
          </DialogTitle>
          <DialogDescription>Organize your income and expenses into buckets.</DialogDescription>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Groceries, Salary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 items-end gap-4">
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
                          {CATEGORY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type === 'income' ? 'Income' : 'Expense'}
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
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent category</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None — top level</SelectItem>
                        {availableParents.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchType === 'expense' && (
              <FormField
                control={form.control}
                name="bucket"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>50 / 30 / 20 bucket</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? 'none'}
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select a bucket" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None — not tracked</SelectItem>
                          {BUDGET_BUCKETS.map((bucket) => (
                            <SelectItem key={bucket} value={bucket}>
                              {bucket === 'needs' ? 'Needs' : bucket === 'wants' ? 'Wants' : 'Savings'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add category'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}