'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HandCoins, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { formatDate, formatMoney, todayISO } from '@/lib/format';

type AccountOption = { id: string; label: string; currency: string };
type PersonView = { id: string; displayName: string; contact: string | null; note: string | null };
type DebtView = {
  id: string;
  personId: string;
  direction: 'receivable' | 'payable';
  originalPrincipal: string;
  currency: 'PHP' | 'USD';
  status: 'open' | 'partially_paid' | 'paid' | 'written_off';
  openedAt: string;
  dueDate: string | null;
  note: string | null;
  isHidden: boolean;
  outstandingBalance: string;
  person: PersonView;
  adjustments: Array<{ id: string; amount: string; reason: string; date: string }>;
  payments: Array<{ id: string; amount: string; date: string; note: string | null; cashEvent: { accountId: string } | null }>;
};

type PersonDraft = { displayName: string; contact: string; note: string };
const emptyPerson: PersonDraft = { displayName: '', contact: '', note: '' };

export function DebtManager({ accounts }: { accounts: AccountOption[] }) {
  const [debts, setDebts] = useState<DebtView[]>([]);
  const [people, setPeople] = useState<PersonView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [resumeDebtAfterPerson, setResumeDebtAfterPerson] = useState(false);
  const [newDebtPersonId, setNewDebtPersonId] = useState('');
  const [editingPerson, setEditingPerson] = useState<PersonView | null>(null);
  const [entry, setEntry] = useState<{ debt: DebtView; kind: 'payment' | 'adjustment' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDebts, nextPeople] = await Promise.all([
        apiFetch<DebtView[]>('/api/debts'),
        apiFetch<PersonView[]>('/api/persons'),
      ]);
      setDebts(nextDebts);
      setPeople(nextPeople);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load debts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, DebtView[]>();
    for (const debt of debts.filter((debt) => !debt.isHidden)) map.set(debt.person.displayName, [...(map.get(debt.person.displayName) ?? []), debt]);
    return [...map.entries()];
  }, [debts]);
  const hiddenDebts = useMemo(() => debts.filter((debt) => debt.isHidden), [debts]);

  async function statusAction(debt: DebtView, action: 'reopen' | 'write_off') {
    try {
      await apiFetch(`/api/debts/${debt.id}/status`, { method: 'POST', body: JSON.stringify({ action }) });
      toast.success(action === 'reopen' ? 'Debt reopened' : 'Debt written off');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to update debt');
    }
  }

  async function visibilityAction(debt: DebtView, action: 'hide' | 'unhide') {
    try {
      await apiFetch(`/api/debts/${debt.id}/visibility`, { method: 'POST', body: JSON.stringify({ action }) });
      toast.success(action === 'hide' ? 'Debt hidden' : 'Debt restored to the normal list');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to update debt visibility');
    }
  }

  async function removePerson(person: PersonView) {
    try {
      await apiFetch(`/api/persons/${person.id}`, { method: 'DELETE' });
      toast.success('Person deleted');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete person');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Debts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track money owed to you and money you owe, with or without account cash movements.</p>
        </div>
        <Button onClick={() => setShowDebtForm(true)}><Plus /> New debt</Button>
      </div>

      {error ? <p className="rounded-md bg-expense/15 p-3 text-sm text-expense">{error}</p> : null}
      {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading debts...</CardContent></Card> : null}
      {!loading && debts.length === 0 ? (
        <Card><CardContent className="space-y-3 p-8 text-center">
          <HandCoins className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">No debts yet</p>
          <p className="text-sm text-muted-foreground">Create your first debt to record an amount you lent, borrowed, or need to settle.</p>
          <Button onClick={() => setShowDebtForm(true)}>Create your first debt</Button>
        </CardContent></Card>
      ) : null}

      {groups.map(([personName, personDebts]) => (
        <section key={personName} className="space-y-3" aria-label={`${personName}'s debts`}>
          <h2 className="font-display text-lg font-semibold text-foreground">{personName}</h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {personDebts.map((debt) => <DebtCard key={debt.id} debt={debt} onEntry={setEntry} onStatus={statusAction} onVisibility={visibilityAction} onSaved={load} />)}
          </div>
        </section>
      ))}

      {hiddenDebts.length > 0 ? <section className="space-y-3" aria-label="Hidden debts">
        <div><h2 className="font-display text-lg font-semibold text-foreground">Hidden debts</h2><p className="text-sm text-muted-foreground">Closed debts stay in your ledger and dashboard totals. Unhide one to return it to the normal list.</p></div>
        <div className="grid gap-3 xl:grid-cols-2">
          {hiddenDebts.map((debt) => <DebtCard key={debt.id} debt={debt} onEntry={setEntry} onStatus={statusAction} onVisibility={visibilityAction} onSaved={load} />)}
        </div>
      </section> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-display text-lg">People</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setEditingPerson(null); setShowPersonForm(true); }}><Plus /> Add person</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {people.length === 0 ? <p className="text-sm text-muted-foreground">Add people here or while creating a debt.</p> : people.map((person) => {
            const hasDebt = debts.some((debt) => debt.personId === person.id);
            return <div key={person.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0"><p className="font-medium text-foreground">{person.displayName}</p><p className="truncate text-xs text-muted-foreground">{person.contact || person.note || 'No contact details'}</p></div>
              <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => { setEditingPerson(person); setShowPersonForm(true); }} aria-label={`Edit ${person.displayName}`}><Pencil /> Edit</Button><Button size="sm" variant="ghost" disabled={hasDebt} className="text-expense" onClick={() => void removePerson(person)} aria-label={`Delete ${person.displayName}`}><Trash2 /> Delete</Button></div>
            </div>;
          })}
        </CardContent>
      </Card>

      {showPersonForm ? <PersonForm person={editingPerson} onCancel={() => { setShowPersonForm(false); setResumeDebtAfterPerson(false); }} onSaved={async (person) => { setShowPersonForm(false); await load(); if (resumeDebtAfterPerson) { setNewDebtPersonId(person.id); setShowDebtForm(true); setResumeDebtAfterPerson(false); } }} /> : null}
      {showDebtForm ? <DebtForm people={people} accounts={accounts} initialPersonId={newDebtPersonId} onCreatePerson={() => { setShowDebtForm(false); setEditingPerson(null); setResumeDebtAfterPerson(true); setShowPersonForm(true); }} onCancel={() => setShowDebtForm(false)} onSaved={async () => { setShowDebtForm(false); await load(); }} /> : null}
      {entry ? <EntryForm debt={entry.debt} kind={entry.kind} accounts={accounts} onCancel={() => setEntry(null)} onSaved={async () => { setEntry(null); await load(); }} /> : null}
    </div>
  );
}

function DebtCard({ debt, onEntry, onStatus, onVisibility, onSaved }: { debt: DebtView; onEntry: (entry: { debt: DebtView; kind: 'payment' | 'adjustment' }) => void; onStatus: (debt: DebtView, action: 'reopen' | 'write_off') => Promise<void>; onVisibility: (debt: DebtView, action: 'hide' | 'unhide') => Promise<void>; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [dueDate, setDueDate] = useState(debt.dueDate ?? '');
  const [note, setNote] = useState(debt.note ?? '');
  const isActive = debt.status === 'open' || debt.status === 'partially_paid';
  async function save() {
    try {
      await apiFetch(`/api/debts/${debt.id}`, { method: 'PATCH', body: JSON.stringify({ dueDate: dueDate || null, note: note || null }) });
      toast.success('Debt details updated');
      setEditing(false);
      await onSaved();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to update debt'); }
  }
  return <Card>
    <CardContent className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-foreground">{debt.direction === 'receivable' ? 'They owe you' : 'You owe them'}</p><p className="text-sm text-muted-foreground">Opened {formatDate(debt.openedAt)}{debt.dueDate ? ` · Due ${formatDate(debt.dueDate)}` : ''}</p></div><span className={debt.direction === 'receivable' ? 'font-semibold text-income' : 'font-semibold text-expense'}>{formatMoney(debt.outstandingBalance, debt.currency)}</span></div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-accent px-2 py-1 text-muted-foreground">{debt.status.replace('_', ' ')}</span><span className="rounded-full bg-accent px-2 py-1 text-muted-foreground">Principal {formatMoney(debt.originalPrincipal, debt.currency)}</span><span className="rounded-full bg-accent px-2 py-1 text-muted-foreground">{debt.payments.length} payment{debt.payments.length === 1 ? '' : 's'}</span></div>
      {debt.note ? <p className="text-sm text-muted-foreground">{debt.note}</p> : null}
      {editing ? <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><Input value={note} placeholder="Note" onChange={(event) => setNote(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => void save()}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div></div> : null}
      <div className="flex flex-wrap gap-1 border-t border-border pt-3"><Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}><Pencil /> Edit</Button>{isActive ? <><Button size="sm" variant="ghost" onClick={() => onEntry({ debt, kind: 'payment' })}>Record payment</Button><Button size="sm" variant="ghost" onClick={() => onEntry({ debt, kind: 'adjustment' })}>Adjustment</Button><Button size="sm" variant="ghost" className="text-expense" onClick={() => void onStatus(debt, 'write_off')}>Write off</Button></> : <><Button size="sm" variant="ghost" onClick={() => void onStatus(debt, 'reopen')}><RotateCcw /> Reopen</Button><Button size="sm" variant="ghost" onClick={() => void onVisibility(debt, debt.isHidden ? 'unhide' : 'hide')}>{debt.isHidden ? 'Unhide' : 'Hide'}</Button></>}</div>
    </CardContent>
  </Card>;
}

function PersonForm({ person, onCancel, onSaved }: { person: PersonView | null; onCancel: () => void; onSaved: (person: PersonView) => Promise<void> }) {
  const [draft, setDraft] = useState<PersonDraft>(person ? { displayName: person.displayName, contact: person.contact ?? '', note: person.note ?? '' } : emptyPerson);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const saved = await apiFetch<PersonView>(person ? `/api/persons/${person.id}` : '/api/persons', { method: person ? 'PATCH' : 'POST', body: JSON.stringify(draft) }); toast.success(person ? 'Person updated' : 'Person created'); await onSaved(saved); } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to save person'); } finally { setSaving(false); } }
  return <Card><CardHeader><CardTitle className="font-display">{person ? 'Edit person' : 'New person'}</CardTitle></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}><Input required value={draft.displayName} placeholder="Display name" onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /><Input value={draft.contact} placeholder="Contact (optional)" onChange={(event) => setDraft({ ...draft, contact: event.target.value })} /><Input className="sm:col-span-2" value={draft.note} placeholder="Note (optional)" onChange={(event) => setDraft({ ...draft, note: event.target.value })} /><div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save person'}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div></form></CardContent></Card>;
}

function DebtForm({ people, accounts, initialPersonId, onCreatePerson, onCancel, onSaved }: { people: PersonView[]; accounts: AccountOption[]; initialPersonId: string; onCreatePerson: () => void; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [personId, setPersonId] = useState(initialPersonId || people[0]?.id || '');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<'receivable' | 'payable'>('receivable');
  const [currency, setCurrency] = useState<'PHP' | 'USD'>('PHP');
  const [amount, setAmount] = useState(''); const [openedAt, setOpenedAt] = useState(todayISO()); const [dueDate, setDueDate] = useState(''); const [note, setNote] = useState(''); const [openingAccountId, setOpeningAccountId] = useState(''); const [saving, setSaving] = useState(false);
  const filteredPeople = people.filter((person) => person.displayName.toLowerCase().includes(query.trim().toLowerCase()));
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { await apiFetch('/api/debts', { method: 'POST', body: JSON.stringify({ personId, direction, originalPrincipal: amount, currency, openedAt, dueDate: dueDate || null, note: note || null, openingAccountId: openingAccountId || null }) }); toast.success('Debt created'); await onSaved(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to create debt'); } finally { setSaving(false); } }
  return <Card><CardHeader><CardTitle className="font-display">New debt</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={submit}><div className="space-y-2"><label className="text-sm font-medium">Person</label><Input value={query} placeholder="Search people" onChange={(event) => setQuery(event.target.value)} /><select required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={personId} onChange={(event) => setPersonId(event.target.value)}><option value="">Select a person</option>{filteredPeople.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select><Button type="button" size="sm" variant="ghost" onClick={onCreatePerson}>Create new person</Button></div><div className="space-y-2"><label className="text-sm font-medium">Direction</label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="receivable">They owe you</option><option value="payable">You owe them</option></select><label className="text-sm font-medium">Currency</label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={(event) => { setCurrency(event.target.value as typeof currency); setOpeningAccountId(''); }}><option value="PHP">PHP</option><option value="USD">USD</option></select></div><Input required type="number" min="0.01" step="0.01" value={amount} placeholder="Original principal" onChange={(event) => setAmount(event.target.value)} /><Input required type="date" value={openedAt} onChange={(event) => setOpenedAt(event.target.value)} /><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><Input value={note} placeholder="Note (optional)" onChange={(event) => setNote(event.target.value)} /><div className="space-y-2 md:col-span-2"><label className="text-sm font-medium">Opening cash account (optional)</label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={openingAccountId} onChange={(event) => setOpeningAccountId(event.target.value)}><option value="">No tracked cash movement</option>{accounts.filter((account) => account.currency === currency).map((account) => <option key={account.id} value={account.id}>{account.label} ({account.currency})</option>)}</select><p className="text-xs text-muted-foreground">Only same-currency accounts are available. A linked event changes the account balance but not spending reports.</p></div><div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving || !personId}>{saving ? 'Saving...' : 'Create debt'}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div></form></CardContent></Card>;
}

function EntryForm({ debt, kind, accounts, onCancel, onSaved }: { debt: DebtView; kind: 'payment' | 'adjustment'; accounts: AccountOption[]; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayISO()); const [note, setNote] = useState(''); const [accountId, setAccountId] = useState(''); const [reason, setReason] = useState('correction'); const [otherReason, setOtherReason] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); try { const path = kind === 'payment' ? 'payments' : 'adjustments'; const body = kind === 'payment' ? { amount, date, note: note || null, accountId: accountId || null } : { amount, date, reason, ...(reason === 'other' ? { otherReason } : {}) }; await apiFetch(`/api/debts/${debt.id}/${path}`, { method: 'POST', body: JSON.stringify(body) }); toast.success(kind === 'payment' ? 'Payment recorded' : 'Adjustment recorded'); await onSaved(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Unable to save entry'); } finally { setSaving(false); } }
  return <Card><CardHeader><CardTitle className="font-display">{kind === 'payment' ? 'Record payment' : 'Record adjustment'} · {debt.person.displayName}</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={submit}><Input required type="number" step="0.01" min={kind === 'payment' ? '0.01' : undefined} value={amount} placeholder={kind === 'payment' ? `Up to ${debt.outstandingBalance}` : 'Use negative to reduce principal'} onChange={(event) => setAmount(event.target.value)} /><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />{kind === 'payment' ? <><Input value={note} placeholder="Note (optional)" onChange={(event) => setNote(event.target.value)} /><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Settled outside tracked accounts</option>{accounts.filter((account) => account.currency === debt.currency).map((account) => <option key={account.id} value={account.id}>{account.label} ({account.currency})</option>)}</select></> : <><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)}><option value="correction">Correction</option><option value="agreed_reduction">Agreed reduction</option><option value="partial_forgiveness">Partial forgiveness</option><option value="other">Other</option></select>{reason === 'other' ? <Input required value={otherReason} placeholder="Describe the reason" onChange={(event) => setOtherReason(event.target.value)} /> : <div />}</>}<div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div></form></CardContent></Card>;
}
