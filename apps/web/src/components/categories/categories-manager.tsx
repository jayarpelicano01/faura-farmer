'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryType } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryForm, type CategoryFormValues } from './category-form';

interface CategoryTree {
  income: Category[];
  expense: Category[];
}

function CategoryRow({
  category,
  depth,
  onEdit,
  onDelete,
  onAddChild,
}: {
  category: Category;
  depth: number;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parent: Category) => void;
}) {
  return (
    <div className="space-y-1">
      <div
        className="group flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
        style={{ marginLeft: depth * 20 }}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? '#adb5bd' }}
        />
        <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" onClick={() => onAddChild(category)} title="Add sub-category">
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(category)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-expense" onClick={() => onDelete(category)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      {category.children?.map((child) => (
        <CategoryRow
          key={child.id}
          category={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

function CategoryColumn({
  title,
  type,
  categories,
  variant,
  onAdd,
  onEdit,
  onDelete,
  onAddChild,
}: {
  title: string;
  type: CategoryType;
  categories: Category[];
  variant: 'income' | 'expense';
  onAdd: (type: CategoryType) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parent: Category) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display text-lg" >
          {title}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => onAdd(type)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {title.toLowerCase()} categories yet.</p>
        ) : (
          categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              depth={0}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CategoriesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tree, setTree] = useState<CategoryTree>({ income: [], expense: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<CategoryFormValues | null>(null);
  const [formType, setFormType] = useState<CategoryType>('expense');
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

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
      router.replace(qs ? `/categories?${qs}` : '/categories', { scroll: false });
    }
  }

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CategoryTree>('/api/categories');
      setTree(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate(type: CategoryType) {
    setFormType(type);
    setEditing({ name: '', type, parentId: null, color: '#adb5bd' });
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setFormType(category.type);
    setEditing({
      id: category.id,
      name: category.name,
      type: category.type,
      parentId: category.parentId,
      color: category.color,
      bucket: category.bucket,
    });
    setDialogOpen(true);
  }

  function openAddChild(parent: Category) {
    setFormType(parent.type);
    setEditing({ name: '', type: parent.type, parentId: parent.id, color: '#adb5bd' });
    setDialogOpen(true);
  }

  function handleDelete(category: Category) {
    setPendingDelete(category);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await apiFetch(`/api/categories/${pendingDelete.id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete category');
    }
  }

  const parents = [
    ...tree.income.map((c) => ({ id: c.id, name: c.name, type: c.type as CategoryType })),
    ...tree.expense.map((c) => ({ id: c.id, name: c.name, type: c.type as CategoryType })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize income and expenses. Sub-categories are optional.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {['Income', 'Expense'].map((title) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryColumn
            title="Income"
            type="income"
            categories={tree.income}
            variant="income"
            onAdd={openCreate}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddChild={openAddChild}
          />
          <CategoryColumn
            title="Expense"
            type="expense"
            categories={tree.expense}
            variant="expense"
            onAdd={openCreate}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddChild={openAddChild}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete category"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? Its sub-categories will be removed too. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />

      <CategoryForm
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSaved={load}
        initial={editing}
        parents={parents}
      />
    </div>
  );
}