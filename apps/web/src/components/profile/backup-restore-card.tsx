'use client';

import { useRef, useState } from 'react';
import type { BackupEntityCounts, BackupRestorePreview } from '@faura-farmer/types';
import { Download, FileUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

type Receipt = {
  importedAt: string;
  entityCounts: BackupEntityCounts;
  status: string;
};

type Preview = BackupRestorePreview;

function countsSummary(counts: BackupEntityCounts) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return 'no new records';
  return entries.map(([entity, count]) => `${count} ${entity.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ');
}

function fileName() {
  return `faura-farmer-backup-${new Date().toISOString().slice(0, 10)}.faura-backup.json`;
}

export function BackupRestoreCard({ initialReceipt }: { initialReceipt: Receipt | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'preview' | 'confirm' | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(initialReceipt);
  const [dismissed, setDismissed] = useState(false);

  async function exportBackup() {
    setBusy('export');
    try {
      const response = await fetch('/api/backup/export');
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'Unable to export backup');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName();
      link.click();
      URL.revokeObjectURL(url);
      if (response.headers.has('X-Faura-Backup-Warning')) {
        toast.warning('Your backup is larger than 5 MB. Keep the download somewhere safe.');
      } else {
        toast.success('Backup downloaded');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export backup.');
    } finally {
      setBusy(null);
    }
  }

  async function previewFile(selected: File | null) {
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('Backup files are limited to 5 MB.');
      return;
    }
    setBusy('preview');
    try {
      const content = await selected.text();
      const next = await apiFetch<Preview>('/api/backup/import', {
        method: 'POST',
        body: JSON.stringify({ action: 'preview', file: content }),
      });
      setFile(content);
      setPreview(next);
      if (!next.canRestore) toast.info(next.conflicts[0]?.message ?? 'This backup has no new records to restore.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to preview backup.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function confirmRestore() {
    if (!file) return;
    setBusy('confirm');
    try {
      const result = await apiFetch<{ receipt: Receipt; duplicate: boolean }>('/api/backup/import', {
        method: 'POST',
        body: JSON.stringify({ action: 'confirm', file }),
      });
      setReceipt(result.receipt);
      setDismissed(false);
      setPreview(null);
      setFile(null);
      toast.success(result.duplicate ? 'This backup was already restored.' : `Backup restored: ${preview?.willAdd ? countsSummary(preview.willAdd) : 'new records'}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to restore backup.');
    } finally {
      setBusy(null);
    }
  }

  return <>
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">Backup &amp; restore</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Download a portable copy of your financial data, or restore a backup into this account. Restore adds newly owned records and never replaces existing data.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => void exportBackup()} disabled={busy !== null}>
            {busy === 'export' ? <Spinner /> : <Download />} {busy === 'export' ? 'Preparing backup...' : 'Export backup'}
          </Button>
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy !== null}>
            {busy === 'preview' ? <Spinner /> : <FileUp />} {busy === 'preview' ? 'Reading backup...' : 'Restore backup'}
          </Button>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".faura-backup.json,application/json"
            onChange={(event) => void previewFile(event.target.files?.[0] ?? null)}
          />
        </div>
        {receipt && !dismissed ? <div className="flex items-start justify-between gap-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm">
          <p><span className="font-medium">Last backup restored on {new Date(receipt.importedAt).toLocaleDateString()}.</span> {countsSummary(receipt.entityCounts)} imported.</p>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2" aria-label="Dismiss backup restore confirmation" onClick={() => setDismissed(true)}><X className="h-4 w-4" /></Button>
        </div> : null}
      </CardContent>
    </Card>

    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open && busy !== 'confirm') setPreview(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore backup?</DialogTitle>
          <DialogDescription>Review the financial records that will be added to this account. Existing records will not be replaced.</DialogDescription>
        </DialogHeader>
        {preview ? <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Restoring will add {countsSummary(preview.willAdd)}.</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border p-3 text-sm">
            {Object.entries(preview.willAdd).map(([entity, count]) => <div key={entity} className="flex justify-between gap-3"><dt className="text-muted-foreground">{entity.replace(/([A-Z])/g, ' $1')}</dt><dd className="font-medium">{count}</dd></div>)}
          </dl>
          <p className="text-sm text-muted-foreground">Already present: {countsSummary(preview.alreadyPresent)}.</p>
          {preview.conflicts.map((conflict) => <p key={conflict.code} className="rounded-md bg-expense/15 p-3 text-sm text-expense">{conflict.message}</p>)}
        </div> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy === 'confirm'} onClick={() => setPreview(null)}>Cancel</Button>
          <Button type="button" disabled={busy === 'confirm' || !preview?.canRestore} onClick={() => void confirmRestore()}>{busy === 'confirm' ? <Spinner /> : <FileUp />}{busy === 'confirm' ? 'Restoring...' : 'Confirm restore'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
