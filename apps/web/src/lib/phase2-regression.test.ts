import { describe, expect, it } from 'vitest';
import { createRecurringRuleSchema } from '@faura-farmer/types';
import { advanceRecurringDate, dateKey } from './services/recurring-transactions';
import { CSV_COLUMNS, parseTransactionCsv } from './csv/transactions';
import { newReceiptStoragePath, validateReceiptFile } from './storage/receipts';

const transactionId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';

function csvRow(values: Partial<Record<(typeof CSV_COLUMNS)[number], string>>) {
  return CSV_COLUMNS.map((column) => values[column] ?? '').join(',');
}

describe('Phase 2 financial workflows', () => {
  it('keeps recurring rules to income and expense and advances one interval', () => {
    const base = { accountId, amount: 100, frequency: 'monthly', nextDueDate: '2026-01-31' };
    expect(createRecurringRuleSchema.safeParse({ ...base, type: 'income' }).success).toBe(true);
    expect(createRecurringRuleSchema.safeParse({ ...base, type: 'transfer' }).success).toBe(false);
    expect(dateKey(advanceRecurringDate(new Date('2026-01-31T00:00:00.000Z'), 'monthly'))).toBe('2026-02-28');
  });

  it('advances weekly and yearly occurrences one interval at a time', () => {
    const due = new Date('2026-01-31T00:00:00.000Z');
    expect(dateKey(advanceRecurringDate(due, 'weekly'))).toBe('2026-02-07');
    expect(dateKey(advanceRecurringDate(due, 'yearly'))).toBe('2027-01-31');
  });

  it('parses an ordinary canonical CSV row', () => {
    const csv = [
      CSV_COLUMNS.join(','),
      csvRow({ transaction_id: transactionId, account_id: accountId, amount: '45.5', type: 'expense', date: '2026-08-31', note: 'Groceries' }),
    ].join('\n');
    const [row] = parseTransactionCsv(csv);
    expect(row?.errors).toEqual([]);
    expect(row?.amount).toBe('45.50');
  });

  it('rejects incomplete CSV transfers and duplicate IDs', () => {
    const csv = [
      CSV_COLUMNS.join(','),
      csvRow({ transaction_id: transactionId, account_id: accountId, amount: '1', type: 'income', date: '2026-08-01' }),
      csvRow({ transaction_id: transactionId, account_id: accountId, amount: '1', type: 'transfer', date: '2026-08-02' }),
    ].join('\n');
    const rows = parseTransactionCsv(csv);
    expect(rows[1]?.errors.join(' ')).toMatch(/Duplicate transaction_id/);
    expect(rows[1]?.errors.join(' ')).toMatch(/destination account/i);
  });

  it('validates receipt signatures and generates scoped storage paths', async () => {
    const png = Object.assign(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }),
      { name: 'receipt.png' },
    ) as File;
    await expect(validateReceiptFile(png)).resolves.toMatchObject({ mimeType: 'image/png' });
    expect(newReceiptStoragePath('user-id', 'transaction-id', 'image/webp')).toMatch(/^receipts\/user-id\/transaction-id\//);
  });

  it('rejects a spoofed receipt MIME type', async () => {
    const spoofed = Object.assign(
      new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], { type: 'image/png' }),
      { name: 'receipt.png' },
    ) as File;
    await expect(validateReceiptFile(spoofed)).rejects.toThrow(/signature/i);
  });
});
