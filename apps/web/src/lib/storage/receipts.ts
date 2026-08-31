import { randomUUID } from 'node:crypto';

export const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_RECEIPT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPTS_PER_TRANSACTION = 5;

type ReceiptMimeType = (typeof RECEIPT_MIME_TYPES)[number];

export class ReceiptStorageError extends Error {
  constructor(message: string, public readonly unavailable = false) {
    super(message);
  }
}

function storageConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !serviceRoleKey || !bucket) {
    throw new ReceiptStorageError('Receipt storage is not configured', true);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(bucket)) {
    throw new ReceiptStorageError('Receipt storage bucket is invalid', true);
  }
  return { url, serviceRoleKey, bucket, base: `${url}/storage/v1` };
}

function objectUrl(base: string, bucket: string, storagePath: string) {
  const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${base}/object/${encodeURIComponent(bucket)}/${encodedPath}`;
}

function storageHeaders(serviceRoleKey: string) {
  return { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
}

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 255);
  return cleaned || 'receipt';
}

function extensionFor(mimeType: ReceiptMimeType) {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
}

export async function validateReceiptFile(file: File): Promise<{
  mimeType: ReceiptMimeType;
  originalFilename: string;
  fileSize: number;
}> {
  if (file.size <= 0) throw new ReceiptStorageError('Receipt file is empty');
  if (file.size > MAX_RECEIPT_FILE_BYTES) {
    throw new ReceiptStorageError('Each receipt is limited to 10 MB');
  }
  if (!RECEIPT_MIME_TYPES.includes(file.type as ReceiptMimeType)) {
    throw new ReceiptStorageError('Receipts must be JPEG, PNG, or WebP images');
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const detected: ReceiptMimeType | null =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'image/jpeg'
      : bytes.length >= 8 &&
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47 &&
          bytes[4] === 0x0d &&
          bytes[5] === 0x0a &&
          bytes[6] === 0x1a &&
          bytes[7] === 0x0a
        ? 'image/png'
        : bytes.length >= 12 &&
            bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x45 &&
            bytes[10] === 0x42 &&
            bytes[11] === 0x50
          ? 'image/webp'
          : null;
  if (!detected || detected !== file.type) {
    throw new ReceiptStorageError('Receipt MIME type does not match its file signature');
  }
  return { mimeType: detected, originalFilename: sanitizeFilename(file.name), fileSize: file.size };
}

export function newReceiptStoragePath(userId: string, transactionId: string, mimeType: ReceiptMimeType) {
  return `receipts/${userId}/${transactionId}/${randomUUID()}.${extensionFor(mimeType)}`;
}

export async function uploadReceiptObject(storagePath: string, file: File, mimeType: ReceiptMimeType) {
  const { base, bucket, serviceRoleKey } = storageConfig();
  const response = await fetch(objectUrl(base, bucket, storagePath), {
    method: 'POST',
    headers: { ...storageHeaders(serviceRoleKey), 'Content-Type': mimeType, 'x-upsert': 'false' },
    body: file,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ReceiptStorageError(`Receipt upload failed (${response.status})`, response.status >= 500);
  }
}

export async function createReceiptSignedUrl(storagePath: string, expiresInSeconds = 5 * 60) {
  const { url, base, bucket, serviceRoleKey } = storageConfig();
  const response = await fetch(`${objectUrl(base, bucket, storagePath).replace('/object/', '/object/sign/')}`, {
    method: 'POST',
    headers: { ...storageHeaders(serviceRoleKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ReceiptStorageError(`Could not create receipt link (${response.status})`, response.status >= 500);
  }
  const data = (await response.json().catch(() => null)) as { signedURL?: string; signedUrl?: string } | null;
  const signed = data?.signedURL ?? data?.signedUrl;
  if (!signed) throw new ReceiptStorageError('Storage did not return a receipt link', true);
  if (/^https?:\/\//i.test(signed)) return signed;
  return signed.startsWith('/storage/v1/') ? `${url}${signed}` : `${base}${signed.startsWith('/') ? signed : `/${signed}`}`;
}

export async function deleteReceiptObjects(storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  const { base, bucket, serviceRoleKey } = storageConfig();
  const response = await fetch(`${base}/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: { ...storageHeaders(serviceRoleKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: storagePaths }),
    cache: 'no-store',
  });
  if (!response.ok && response.status !== 404) {
    throw new ReceiptStorageError(`Receipt removal failed (${response.status})`, response.status >= 500);
  }
}
