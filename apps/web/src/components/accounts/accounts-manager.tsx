'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import type { AccountWithBalance } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisplayCurrency } from '@/components/currency/display-currency-provider';
import { AccountForm, type AccountFormValues } from './account-form';

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  e_wallet: 'E-wallet',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

export function AccountsManager() {
  const { formatMoney } = useDisplayCurrency();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get('new') === '1');
  const [editing, setEditing] = useState<AccountFormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountWithBalance | null>(null);

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
      router.replace(qs ? `/accounts?${qs}` : '/accounts', { scroll: false });
    }
  }

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AccountWithBalance[]>('/api/accounts');
      setAccounts(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: AccountWithBalance) {
    setEditing({
      id: account.id,
      label: account.label,
      type: account.type,
      currency: account.currency,
      startingBalance: account.startingBalance,
      currentBalance: account.balance,
      color: account.color,
    });
    setDialogOpen(true);
  }

  async function toggleArchive(account: AccountWithBalance) {
    try {
      await apiFetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !account.isArchived }),
      });
      toast.success(account.isArchived ? 'Account restored' : 'Account archived');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update account');
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await apiFetch(`/api/accounts/${pendingDelete.id}`, { method: 'DELETE' });
      toast.success('Account deleted');
      load();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete account');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your bank accounts, e-wallets, cash, cards and investments.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New account
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
                <Skeleton className="mt-4 h-7 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <Skeleton className="h-9 w-16 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No accounts yet. Create your first one to start tracking.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className={account.isArchived ? 'opacity-70' : undefined}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: account.color ?? '#adb5bd' }}
                    >
                      <PiggyBank className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{account.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[account.type] ?? account.type}
                      </p>
                    </div>
                  </div>
                  {account.isArchived && <Badge variant="muted">Archived</Badge>}
                </div>
                <p className="mt-4 font-display text-xl font-semibold text-foreground">
                  {formatMoney(account.balance, account.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Starting {formatMoney(account.startingBalance, account.currency)}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <Button variant="outline" size="sm" onClick={() => openEdit(account)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleArchive(account)}>
                    {account.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {account.isArchived ? 'Restore' : 'Archive'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-expense"
                    onClick={() => setPendingDelete(account)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete account"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.label}"? This also removes its transactions. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

      <AccountForm
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSaved={load}
        initial={editing}
      />
    </div>
  );
}
