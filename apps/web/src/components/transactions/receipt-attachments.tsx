'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';

type Attachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
};

type UploadItem = { id: string; file: File; preview: string; progress: number };

function uploadWithProgress(url: string, body: FormData, onProgress: (progress: number) => void) {
  return new Promise<{ items: Attachment[] }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      const response = JSON.parse(request.responseText || 'null') as { items?: Attachment[]; error?: string } | null;
      if (request.status >= 200 && request.status < 300 && response?.items) resolve({ items: response.items });
      else reject(new Error(response?.error ?? 'Receipt upload failed'));
    };
    request.onerror = () => reject(new Error('Receipt upload failed'));
    request.send(body);
  });
}

export function ReceiptAttachments({ transactionId }: { transactionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Attachment[]>([]);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Attachment[] }>(`/api/transactions/${transactionId}/attachments`);
      setItems(data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load receipt images');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [transactionId]);
  async function upload(uploadItems: UploadItem[]) {
    if (uploadItems.length === 0) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    uploadItems.forEach((item) => form.append('files', item.file));
    try {
      const result = await uploadWithProgress(`/api/transactions/${transactionId}/attachments`, form, (progress) => setQueue((current) => current.map((item) => ({ ...item, progress }))));
      setItems((current) => [...current, ...result.items]);
      uploadItems.forEach((item) => URL.revokeObjectURL(item.preview));
      setQueue([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Receipt upload failed');
    } finally {
      setUploading(false);
    }
  }

  function chooseFiles(files: FileList | null) {
    const selected = [...(files ?? [])];
    if (selected.length === 0) return;
    if (items.length + selected.length > 5) { setError('A transaction can have at most five receipt images.'); return; }
    const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) { setError('Choose JPEG, PNG, or WebP images no larger than 10 MB.'); return; }
    const next = selected.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0 }));
    setQueue(next);
    void upload(next);
  }

  async function remove(attachment: Attachment) {
    try {
      await apiFetch(`/api/transactions/${transactionId}/attachments/${attachment.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== attachment.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to remove receipt'); }
  }

  return (
    <section className="space-y-3 border-t border-border pt-4" aria-labelledby="receipt-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 id="receipt-heading" className="font-medium text-foreground">Receipt images</h3><p className="text-xs text-muted-foreground">Up to five private JPEG, PNG, or WebP files (10 MB each).</p></div>
        <Input ref={inputRef} className="sr-only" aria-label="Choose receipt images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { chooseFiles(event.target.files); event.target.value = ''; }} />
        <Button type="button" size="sm" variant="outline" disabled={loading || uploading || items.length >= 5} onClick={() => inputRef.current?.click()}><ImagePlus /> Add receipts</Button>
      </div>
      {error && <p className="rounded-md bg-expense/15 px-3 py-2 text-sm text-expense">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((attachment) => <figure key={attachment.id} className="relative overflow-hidden rounded-md border border-border bg-muted"><img className="h-28 w-full object-cover" src={attachment.signedUrl} alt={attachment.originalFilename} /><figcaption className="truncate px-2 py-1 text-xs text-muted-foreground">{attachment.originalFilename}</figcaption><Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-7 w-7" aria-label={`Remove ${attachment.originalFilename}`} onClick={() => void remove(attachment)}><Trash2 /></Button></figure>)}
        {queue.map((item) => <figure key={item.id} className="relative overflow-hidden rounded-md border border-border bg-muted"><img className="h-28 w-full object-cover opacity-60" src={item.preview} alt={`Uploading ${item.file.name}`} /><div className="absolute inset-x-2 bottom-7 h-1.5 overflow-hidden rounded bg-background"><div className="h-full bg-primary-solid" style={{ width: `${item.progress}%` }} /></div><figcaption className="truncate px-2 py-1 text-xs text-muted-foreground">{item.progress}% · {item.file.name}</figcaption></figure>)}
      </div>
      {queue.length > 0 && !uploading && <Button type="button" size="sm" variant="outline" onClick={() => void upload(queue)}><RotateCcw /> Retry upload</Button>}
      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Loading receipts…</p>}
    </section>
  );
}
