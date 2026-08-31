'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit3, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Account, Category } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { RecurringForm, type RecurringRuleView } from './recurring-form';
import { RecurringReviewQueue } from './recurring-review-queue';

type RecurringResponse = { items: RecurringRuleView[]; dueItems: RecurringRuleView[] };

export function RecurringManager({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [items, setItems] = useState<RecurringRuleView[]>([]);
  const [dueItems, setDueItems] = useState<RecurringRuleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRuleView | null>(null);
  const [deleting, setDeleting] = useState<RecurringRuleView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<RecurringResponse>('/api/recurring-rules');
      setItems(data.items);
      setDueItems(data.dueItems);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load recurring rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function process(item: RecurringRuleView, action: 'approve' | 'skip') {
    setPendingId(item.id);
    try {
      await apiFetch(`/api/recurring-rules/${item.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ expectedDueDate: new Date(item.nextDueDate) }),
      });
      toast.success(action === 'approve' ? 'Occurrence approved' : 'Occurrence skipped');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to review occurrence');
    } finally {
      setPendingId(null);
    }
  }

  async function toggle(rule: RecurringRuleView) {
    setPendingId(rule.id);
    try {
      await apiFetch(`/api/recurring-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      toast.success(rule.isActive ? 'Recurring rule paused' : 'Recurring rule resumed');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update recurring rule');
    } finally {
      setPendingId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await apiFetch(`/api/recurring-rules/${deleting.id}`, { method: 'DELETE' });
      toast.success('Recurring rule deleted');
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete recurring rule');
    }
  }

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(rule: RecurringRuleView) { setEditing(rule); setFormOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Recurring</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review scheduled income and expenses before they are added.</p>
        </div>
        <Button onClick={openCreate}><Plus /> New rule</Button>
      </div>
      <RecurringReviewQueue items={dueItems} pendingId={pendingId} onApprove={(item) => void process(item, 'approve')} onSkip={(item) => void process(item, 'skip')} />
      <section aria-labelledby="recurring-rules-heading">
        <div className="mb-3">
          <h2 id="recurring-rules-heading" className="font-display text-lg font-semibold text-foreground">All rules</h2>
          <p className="text-sm text-muted-foreground">Paused rules remain available to edit or resume.</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading recurring rules…</CardContent></Card> : items.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No recurring rules yet.</CardContent></Card> : items.map((rule) => (
            <Card key={rule.id} className={!rule.isActive ? 'opacity-70' : undefined}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{rule.label || rule.category?.name || 'Recurring transaction'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{rule.type === 'income' ? 'Income' : 'Expense'} · {rule.frequency} · {rule.account?.label ?? 'Unknown account'}</p>
                  </div>
                  <span className={rule.type === 'income' ? 'font-semibold text-income' : 'font-semibold text-expense'}>{rule.type === 'income' ? '+' : '−'}{formatMoney(rule.amount, rule.account?.currency ?? 'PHP')}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Next due: <span className="text-foreground">{formatDate(rule.nextDueDate)}</span>{!rule.isActive && ' · Paused'}</span>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)} aria-label={`Edit ${rule.label || 'recurring rule'}`}><Edit3 /> Edit</Button>
                    <Button size="sm" variant="ghost" disabled={pendingId === rule.id} onClick={() => void toggle(rule)} aria-label={`${rule.isActive ? 'Pause' : 'Resume'} ${rule.label || 'recurring rule'}`}>{rule.isActive ? <Pause /> : <Play />}{rule.isActive ? 'Pause' : 'Resume'}</Button>
                    <Button size="sm" variant="ghost" className="text-expense" onClick={() => setDeleting(rule)} aria-label={`Delete ${rule.label || 'recurring rule'}`}><Trash2 /> Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <RecurringForm open={formOpen} onOpenChange={setFormOpen} accounts={accounts} categories={categories} initial={editing} onSaved={load} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title="Delete recurring rule" description="Past transactions will remain, but this rule can no longer create future occurrences." confirmLabel="Delete rule" destructive onConfirm={remove} />
    </div>
  );
}
