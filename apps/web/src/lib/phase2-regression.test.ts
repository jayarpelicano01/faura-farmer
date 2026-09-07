import { describe, expect, it } from 'vitest';
import { createRecurringRuleSchema } from '@faura-farmer/types';
import { advanceRecurringDate, dateKey } from './services/recurring-transactions';
import { CSV_COLUMNS, parseTransactionCsv } from './csv/transactions';

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
});
