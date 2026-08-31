import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, parseTransactionCsv } from '../apps/web/src/lib/csv/transactions';

const id = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const destinationId = '33333333-3333-4333-8333-333333333333';

function row(values: Partial<Record<(typeof CSV_COLUMNS)[number], string>>) {
  const base = Object.fromEntries(CSV_COLUMNS.map((column) => [column, '']));
  return CSV_COLUMNS.map((column) => values[column] ?? base[column]).join(',');
}

describe('transaction CSV parsing', () => {
  it('parses an ordinary canonical row', () => {
    const csv = [
      CSV_COLUMNS.join(','),
      row({
        transaction_id: id,
        account_id: accountId,
        amount: '45.5',
        type: 'expense',
        date: '2026-08-31',
        note: 'Groceries',
      }),
    ].join('\n');
    const [parsed] = parseTransactionCsv(csv);
    expect(parsed?.errors).toEqual([]);
    expect(parsed?.amount).toBe('45.50');
  });

  it('rejects incomplete transfers and invalid calendar dates', () => {
    const csv = [
      CSV_COLUMNS.join(','),
      row({
        transaction_id: id,
        transfer_group_id: '44444444-4444-4444-8444-444444444444',
        transfer_role: 'outgoing',
        account_id: accountId,
        amount: '120',
        type: 'transfer',
        date: '2026-02-30',
      }),
    ].join('\n');
    const [parsed] = parseTransactionCsv(csv);
    expect(parsed?.errors.join(' ')).toMatch(/destination account/i);
    expect(parsed?.errors.join(' ')).toMatch(/YYYY-MM-DD/i);
  });

  it('rejects duplicate identifiers in the same file', () => {
    const csv = [
      CSV_COLUMNS.join(','),
      row({ transaction_id: id, account_id: accountId, amount: '1', type: 'income', date: '2026-08-01' }),
      row({ transaction_id: id, account_id: destinationId, amount: '2', type: 'income', date: '2026-08-02' }),
    ].join('\n');
    const rows = parseTransactionCsv(csv);
    expect(rows[1]?.errors.join(' ')).toMatch(/Duplicate transaction_id/);
  });
});
