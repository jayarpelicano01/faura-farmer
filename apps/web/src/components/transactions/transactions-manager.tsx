'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, ChevronDown, Filter, Search } from 'lucide-react';
import type { Account, Category, Transaction } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TransactionList } from '@/components/transactions/transaction-list';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { resolveTransactionBucket } from '@/lib/meta';
import { TransactionForm, type TransactionFormValues } from './transaction-form';

interface TransactionsManagerProps {
  accounts: Account[];
  categories: Category[];
}

interface ListResponse {
  items: Transaction[];
  total: number;
  page: number;
  perPage: number;
}

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

function buildQuery(params: Record<string, string | undefined>): string {
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) url.set(key, value);
  }
  const qs = url.toString();
  return qs ? `?${qs}` : '';
}

export function TransactionsManager({ accounts, categories }: TransactionsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [type, setType] = useState<string>('all');
  const [accountId, setAccountId] = useState<string>(() => searchParams.get('accountId') ?? 'all');
  const [categoryId, setCategoryId] = useState<string>(() => searchParams.get('categoryId') ?? 'all');
  const [from, setFrom] = useState<string>(() => searchParams.get('from') ?? '');
  const [to, setTo] = useState<string>(() => searchParams.get('to') ?? '');

  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<TransactionFormValues | null>(null);

  const filterKey = `${q}|${type}|${accountId}|${categoryId}|${from}|${to}`;

  useEffect(() => {
    const params = {
      q: q || undefined,
      type: type && type !== 'all' ? type : undefined,
      accountId: accountId && accountId !== 'all' ? accountId : undefined,
      categoryId: categoryId && categoryId !== 'all' ? categoryId : undefined,
      from: from || undefined,
      to: to || undefined,
    };
    const qs = buildQuery(params);
    router.replace(qs ? `/transactions${qs}` : '/transactions', { scroll: false });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        perPage: String(perPage),
      };
      if (q) params.q = q;
      if (type !== 'all') params.type = type;
      if (accountId !== 'all') params.accountId = accountId;
      if (categoryId !== 'all') params.categoryId = categoryId;
      if (from) params.from = from;
      if (to) params.to = to;

      const data = await apiFetch<ListResponse>(`/api/transactions${buildQuery(params)}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [q, type, accountId, categoryId, from, to, page, perPage]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const filteredAccounts = accounts.filter((a) => !a.isArchived || a.id === accountId);

  const newParam = searchParams.get('new');
  const typeParam = searchParams.get('type');

  useEffect(() => {
    if (newParam !== '1') return;
    const valid: Transaction['type'][] = ['income', 'expense', 'transfer'];
    const preset = valid.includes(typeParam as Transaction['type'])
      ? (typeParam as Transaction['type'])
      : undefined;
    openCreate(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam, typeParam]);

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open && newParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('new');
      const qs = params.toString();
      router.replace(qs ? `/transactions?${qs}` : '/transactions', { scroll: false });
    }
  }

  function openCreate(preset?: Transaction['type']) {
    setEditing(
      preset
        ? {
            accountId: '',
            destinationAccountId: null,
            bucket: null,
            amount: '',
            type: preset,
            date: new Date().toISOString(),
            note: null,
          }
        : null,
    );
    setDialogOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditing({
      id: tx.id,
      accountId: tx.accountId,
      destinationAccountId: tx.destinationAccountId ?? tx.destinationAccount?.id ?? null,
      categoryId: tx.categoryId,
      bucket: tx.bucket,
      amount: String(tx.amount),
      type: tx.type,
      date: tx.date instanceof Date ? tx.date.toISOString() : new Date(tx.date).toISOString(),
      note: tx.note,
    });
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await apiFetch(`/api/transactions/${pendingDelete.id}`, { method: 'DELETE' });
      toast.success(pendingDelete.type === 'transfer' ? 'Transfer deleted' : 'Transaction deleted');
      setPage(1);
      load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete transaction');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, filter and record transactions.</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          New transaction
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="sm:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-between text-foreground"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Filters
              </span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', filterOpen && 'rotate-180')}
              />
            </Button>
          </div>
          <div
            className={cn(
              'grid gap-4 sm:grid-cols-2 lg:grid-cols-5',
              !filterOpen && 'hidden sm:grid',
            )}
          >
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {filteredAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TransactionList
            variant="full"
            transactions={items}
            loading={loading}
            emptyMessage="No transactions match your filters."
            onEdit={openEdit}
            onDelete={(tx) => setPendingDelete(tx)}
            getBucket={(tx) => resolveTransactionBucket(categories, tx)}
          />
          {total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border p-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                {total} transaction{total === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(perPage)}
                  onValueChange={(value) => {
                    setPerPage(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={pendingDelete?.type === 'transfer' ? 'Delete transfer' : 'Delete transaction'}
        description={
          pendingDelete
            ? pendingDelete.type === 'transfer'
              ? `Delete the transfer of ${formatMoney(
                  pendingDelete.amount,
                  pendingDelete.account?.currency ?? 'PHP',
                )} from ${pendingDelete.account?.label ?? 'the source account'} to ${
                  pendingDelete.destinationAccount?.label ?? 'the destination account'
                }? Both linked entries will be removed. This cannot be undone.`
              : `Delete the ${pendingDelete.type} of ${
                  pendingDelete.amount != null
                    ? formatMoney(
                        pendingDelete.amount,
                        pendingDelete.account?.currency ?? 'PHP',
                      )
                    : ''
                }? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

      <TransactionForm
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSaved={() => {
          setPage(1);
          load();
        }}
        accounts={accounts.map((a) => ({ id: a.id, label: a.label, currency: a.currency }))}
        categories={categories}
        initial={editing}
      />
    </div>
  );
}
