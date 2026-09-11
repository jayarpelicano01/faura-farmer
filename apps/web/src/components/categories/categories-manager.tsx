'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryType } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryForm, type CategoryFormValues } from './category-form';

interface CategoryList {
  income: Category[];
  expense: Category[];
}

function CategoryRow({ category, onEdit, onDelete }: {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color ?? '#adb5bd' }} />
      <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>
      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" onClick={() => onEdit(category)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="icon" className="text-expense" onClick={() => onDelete(category)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
      </span>
    </div>
  );
}

function CategoryColumn({
  title,
  type,
  categories,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  type: CategoryType;
  categories: Category[];
  onAdd: (type: CategoryType) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => onAdd(type)}><Plus className="h-3.5 w-3.5" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {categories.length === 0
          ? <p className="text-sm text-muted-foreground">No {title.toLowerCase()} categories yet.</p>
          : categories.map((category) => <CategoryRow key={category.id} category={category} onEdit={onEdit} onDelete={onDelete} />)}
      </CardContent>
    </Card>
  );
}

export function CategoriesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryList>({ income: [], expense: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<CategoryFormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const newParam = searchParams.get('new');

  useEffect(() => {
    if (newParam === '1') {
      setEditing(null);
      setDialogOpen(true);
    }
  }, [newParam]);

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open && newParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      const query = params.toString();
      router.replace(query ? `/categories?${query}` : '/categories', { scroll: false });
    }
  }

  const load = useCallback(async () => {
    try {
      setCategories(await apiFetch<CategoryList>('/api/categories'));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate(type: CategoryType) {
    setEditing({ name: '', type, color: '#adb5bd' });
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing({ id: category.id, name: category.name, type: category.type, color: category.color, bucket: category.bucket });
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await apiFetch(`/api/categories/${pendingDelete.id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      await load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete category');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize income and expenses into clear, direct categories.</p>
      </div>
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {['Income', 'Expense'].map((title) => (
            <Card key={title}>
              <CardHeader><div className="flex items-center justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-9 w-9 rounded-md" /></div></CardHeader>
              <CardContent className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-12 rounded-md border border-border bg-background" />)}</CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryColumn title="Income" type="income" categories={categories.income} onAdd={openCreate} onEdit={openEdit} onDelete={setPendingDelete} />
          <CategoryColumn title="Expense" type="expense" categories={categories.expense} onAdd={openCreate} onEdit={openEdit} onDelete={setPendingDelete} />
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete category"
        description={pendingDelete ? `Delete "${pendingDelete.name}"? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
      <CategoryForm open={dialogOpen} onOpenChange={handleOpenChange} onSaved={load} initial={editing} />
    </div>
  );
}
