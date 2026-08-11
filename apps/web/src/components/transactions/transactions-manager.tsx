'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Account, Category, Transaction, TransactionType } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { TYPE_BADGE_VARIANT } from '@/lib/meta';
import { TransactionForm, type TransactionFormValues } from './transaction-form';

interface TransactionsManagerProps {
  accounts: Account[];
  categories: Category[];
}

interface ListResponse {
  items: Transaction[];
  nextCursor: string | null;
}

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
  const [type, setType] = useState<string>(() => searchParams.get('type') ?? 'all');
  const [accountId, setAccountId] = useState<string>(() => searchParams.get('accountId') ?? 'all');
  const [categoryId, setCategoryId] = useState<string>(() => searchParams.get('categoryId') ?? 'all');
  const [from, setFrom] = useState<string>(() => searchParams.get('from') ?? '');
  const [to, setTo] = useState<string>(() => searchParams.get('to') ?? '');

  const [items, setItems] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
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
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const load = useCallback(
    async (opts: { cursor?: string | null; reset?: boolean } = {}) => {
      setLoading(true);
      try {
        const params: Record<string, string> = { limit: '20' };
        if (q) params.q = q;
        if (type !== 'all') params.type = type;
        if (accountId !== 'all') params.accountId = accountId;
        if (categoryId !== 'all') params.categoryId = categoryId;
        if (from) params.from = from;
        if (to) params.to = to;
        if (opts.cursor) params.cursor = opts.cursor;

        const data = await apiFetch<ListResponse>(`/api/transactions${buildQuery(params)}`);
        if (opts.reset || !opts.cursor) {
          setItems(data.items);
        } else {
          setItems((prev) => [...prev, ...data.items]);
        }
        setNextCursor(data.nextCursor);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [q, type, accountId, categoryId, from, to],
  );

  useEffect(() => {
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const filteredAccounts = accounts.filter((a) => !a.isArchived || a.id === accountId);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(tx: Transaction) {
    setEditing({
      id: tx.id,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      amount: String(tx.amount),
      type: tx.type,
      date: tx.date instanceof Date ? tx.date.toISOString() : new Date(tx.date).toISOString(),
      note: tx.note,
    });
    setDialogOpen(true);
  }

  async function handleDelete(tx: Transaction) {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await apiFetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
      load({ reset: true });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, filter and record transactions.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New transaction
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[1%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No transactions match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {tx.account?.label}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tx.category?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {tx.note || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYPE_BADGE_VARIANT[(tx.type as TransactionType) ?? 'expense']}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        tx.type === 'income'
                          ? 'text-right font-semibold text-income'
                          : tx.type === 'expense'
                            ? 'text-right font-semibold text-expense'
                            : 'text-right font-semibold text-foreground'
                      }
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                      {formatMoney(tx.amount, tx.account?.currency ?? 'PHP')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tx)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-expense"
                          onClick={() => handleDelete(tx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {nextCursor && (
            <div className="flex justify-center p-4">
              <Button variant="outline" onClick={() => load({ cursor: nextCursor })} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => load({ reset: true })}
        accounts={accounts.map((a) => ({ id: a.id, label: a.label, currency: a.currency }))}
        categories={categories}
        initial={editing}
      />
    </div>
  );
}