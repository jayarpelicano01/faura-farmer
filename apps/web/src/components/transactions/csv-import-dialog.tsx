'use client';

import { useMemo, useState } from 'react';
import { FileUp, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Account, Category } from '@faura-farmer/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type MappingNeed = {
  key: string;
  name: string;
  candidates: Array<{ id: string; label: string; type?: 'income' | 'expense' }>;
};

type Preview = {
  rows: Array<{
    index: number;
    transactionId: string;
    type: string | null;
    date: string | null;
    amount: string | null;
    accountName: string;
    destinationAccountName: string;
    categoryName: string;
    note: string;
    errors: string[];
    duplicate: boolean;
  }>;
  unresolvedAccounts: MappingNeed[];
  unresolvedCategories: MappingNeed[];
  summary: { total: number; invalid: number; duplicates: number };
};

type MappingState = { accounts: Record<string, string>; categories: Record<string, string> };

async function postImport<T>(form: FormData): Promise<T> {
  const response = await fetch('/api/transactions/import', { method: 'POST', body: form });
  const body = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) throw new Error(body?.error ?? 'CSV import failed');
  return body;
}

export function CsvImportDialog({ accounts, categories, onImported }: { accounts: Account[]; categories: Category[]; onImported: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<MappingState>({ accounts: {}, categories: {} });
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCount = useMemo(
    () => preview?.rows.filter((row) => !excluded.has(row.index)).length ?? 0,
    [preview, excluded],
  );

  function reset() {
    setFile(null);
    setPreview(null);
    setMappings({ accounts: {}, categories: {} });
    setExcluded(new Set());
    setError(null);
    setBusy(false);
  }

  async function previewFile() {
    if (!file) { setError('Choose a CSV file first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('action', 'preview');
      form.set('file', file);
      form.set('mappings', JSON.stringify(mappings));
      const result = await postImport<Preview>(form);
      setPreview(result);
      setExcluded(new Set(result.rows.filter((row) => row.errors.length > 0 || row.duplicate).map((row) => row.index)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to preview CSV');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('action', 'confirm');
      form.set('file', file);
      form.set('mappings', JSON.stringify(mappings));
      form.set('excludedRows', JSON.stringify([...excluded]));
      const result = await postImport<{ imported: number }>(form);
      await onImported();
      setOpen(false);
      reset();
      toast.success(`${result.imported} transaction${result.imported === 1 ? '' : 's'} imported`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import CSV');
    } finally {
      setBusy(false);
    }
  }

  function setMapping(kind: 'accounts' | 'categories', key: string, value: string) {
    setMappings((current) => ({ ...current, [kind]: { ...current[kind], ...(value === 'unmapped' ? { [key]: undefined } : { [key]: value }) } }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <Button variant="outline" onClick={() => setOpen(true)}><FileUp /> Import CSV</Button>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Import transactions</DialogTitle>
          <DialogDescription>Preview and map CSV rows before a single atomic import. Duplicate candidates are excluded by default.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="transaction-csv">CSV file</Label>
            <Input id="transaction-csv" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(null); }} />
            <p className="text-xs text-muted-foreground">Maximum 10 MB and 10,000 data rows. Use an exported Faura-Farmer CSV for the canonical columns.</p>
          </div>
          {preview && (preview.unresolvedAccounts.length > 0 || preview.unresolvedCategories.length > 0) && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <p className="font-medium text-foreground">Explicit mappings required</p>
                <p className="text-sm text-muted-foreground">Names are never matched automatically. Choose one of your records for each imported name.</p>
              </div>
              {preview.unresolvedAccounts.map((need) => (
                <div key={need.key} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                  <Label>Account “{need.name}”</Label>
                  <Select value={mappings.accounts[need.key] ?? 'unmapped'} onValueChange={(value) => setMapping('accounts', need.key, value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">Choose account</SelectItem>
                      {(need.candidates.length ? need.candidates : accounts.map((account) => ({ id: account.id, label: account.label }))).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {preview.unresolvedCategories.map((need) => (
                <div key={need.key} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                  <Label>Category “{need.name}”</Label>
                  <Select value={mappings.categories[need.key] ?? 'unmapped'} onValueChange={(value) => setMapping('categories', need.key, value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmapped">Choose category</SelectItem>
                      {(need.candidates.length ? need.candidates : categories.map((category) => ({ id: category.id, label: category.name }))).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {preview && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{preview.summary.total} rows · {preview.summary.invalid} need attention · {preview.summary.duplicates} duplicate candidates · {selectedCount} selected</p>
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="sticky top-0 bg-muted text-muted-foreground"><tr><th className="p-2">Import</th><th className="p-2">Row</th><th className="p-2">Type</th><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Issue</th></tr></thead>
                  <tbody>{preview.rows.map((row) => <tr key={row.index} className="border-t border-border"><td className="p-2"><input aria-label={`Import row ${row.index}`} type="checkbox" checked={!excluded.has(row.index)} onChange={(event) => setExcluded((current) => { const next = new Set(current); if (event.target.checked) next.delete(row.index); else next.add(row.index); return next; })} /></td><td className="p-2">{row.index}</td><td className="p-2">{row.type ?? 'Invalid'}</td><td className="p-2">{row.date ?? '—'}</td><td className="p-2">{row.amount ?? '—'}</td><td className="p-2 text-expense">{row.errors[0] ?? (row.duplicate ? 'Duplicate candidate' : '—')}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          {preview ? <Button variant="outline" type="button" disabled={busy} onClick={() => void previewFile()}><RefreshCw /> Refresh preview</Button> : null}
          <Button type="button" disabled={busy || (!preview && !file) || (preview !== null && selectedCount === 0)} onClick={() => void (preview ? confirm() : previewFile())}>{preview ? <><Upload /> {busy ? 'Importing…' : 'Confirm import'}</> : <>{busy ? 'Reading…' : 'Preview CSV'}</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
