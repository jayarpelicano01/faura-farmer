import { describe, expect, it } from 'vitest';
import {
  newReceiptStoragePath,
  validateReceiptFile,
} from '../apps/web/src/lib/storage/receipts';

function file(bytes: number[], type: string, name = 'receipt.png') {
  return Object.assign(new Blob([new Uint8Array(bytes)], { type }), { name }) as File;
}

describe('transaction receipt validation', () => {
  it('accepts a PNG with a matching MIME type and signature', async () => {
    const png = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png');
    await expect(validateReceiptFile(png)).resolves.toMatchObject({ mimeType: 'image/png', originalFilename: 'receipt.png' });
  });

  it('rejects a spoofed MIME type and scopes generated storage paths', async () => {
    const spoofed = file([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'image/png');
    await expect(validateReceiptFile(spoofed)).rejects.toThrow(/signature/i);
    expect(newReceiptStoragePath('user-id', 'transaction-id', 'image/webp')).toMatch(/^receipts\/user-id\/transaction-id\//);
  });
});
