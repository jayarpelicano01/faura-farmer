'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryType } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
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
  const [tree, setTree] = useState<CategoryTree>({ income: [], expense: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryFormValues | null>(null);
  const [formType, setFormType] = useState<CategoryType>('expense');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CategoryTree>('/api/categories');
      setTree(data);
    } catch (error) {
      console.error(error);
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
    });
    setDialogOpen(true);
  }

  function openAddChild(parent: Category) {
    setFormType(parent.type);
    setEditing({ name: '', type: parent.type, parentId: parent.id, color: '#adb5bd' });
    setDialogOpen(true);
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete "${category.name}"?`)) return;
    try {
      await apiFetch(`/api/categories/${category.id}`, { method: 'DELETE' });
      load();
    } catch (error) {
      console.error(error);
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
        <p className="text-sm text-muted-foreground">Loading categories…</p>
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

      <CategoryForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        initial={editing}
        parents={parents}
      />
    </div>
  );
}