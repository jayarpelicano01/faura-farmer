'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import type { AccountWithBalance } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { AccountForm, type AccountFormValues } from './account-form';

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  e_wallet: 'E-wallet',
  cash: 'Cash',
  credit_card: 'Credit card',
  investment: 'Investment',
};

export function AccountsManager() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountFormValues | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<AccountWithBalance[]>('/api/accounts');
      setAccounts(data);
    } catch (error) {
      console.error(error);
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
      institution: account.institution,
      currency: account.currency,
      startingBalance: account.startingBalance,
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
      load();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete(account: AccountWithBalance) {
    if (!window.confirm(`Delete "${account.label}"? This also removes its transactions.`)) return;
    try {
      await apiFetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      load();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-gunmetal md:text-3xl">Accounts</h1>
          <p className="mt-1 text-sm text-slate_grey">
            Your bank accounts, e-wallets, cash, cards and investments.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New account
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate_grey">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate_grey">
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
                      <p className="font-medium text-carbon_black">{account.label}</p>
                      <p className="text-xs text-slate_grey">
                        {TYPE_LABELS[account.type] ?? account.type}
                        {account.institution ? ` · ${account.institution}` : ''}
                      </p>
                    </div>
                  </div>
                  {account.isArchived && <Badge variant="muted">Archived</Badge>}
                </div>
                <p className="mt-4 font-display text-xl font-semibold text-carbon_black">
                  {formatMoney(account.balance, account.currency)}
                </p>
                <p className="text-xs text-slate_grey">
                  Starting {formatMoney(account.startingBalance, account.currency)}
                </p>
                <div className="mt-4 flex items-center gap-2 border-t border-alabaster_grey pt-3">
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
                    onClick={() => handleDelete(account)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AccountForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
        initial={editing}
      />
    </div>
  );
}