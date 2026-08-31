import { describe, expect, it } from 'vitest';
import { createRecurringRuleSchema } from '../packages/types/src/schemas';
import { advanceRecurringDate, dateKey } from '../apps/web/src/lib/services/recurring-transactions';

describe('recurring transactions', () => {
  it('accepts income and expense rules but excludes transfers', () => {
    const base = {
      accountId: '11111111-1111-4111-8111-111111111111',
      amount: 1250,
      frequency: 'monthly',
      nextDueDate: '2026-08-31',
    };
    expect(createRecurringRuleSchema.safeParse({ ...base, type: 'income' }).success).toBe(true);
    expect(createRecurringRuleSchema.safeParse({ ...base, type: 'expense' }).success).toBe(true);
    expect(createRecurringRuleSchema.safeParse({ ...base, type: 'transfer' }).success).toBe(false);
  });

  it('advances exactly one scheduled interval, including overdue rules', () => {
    const due = new Date('2026-01-31T00:00:00.000Z');
    expect(dateKey(advanceRecurringDate(due, 'monthly'))).toBe('2026-02-28');
    expect(dateKey(advanceRecurringDate(due, 'weekly'))).toBe('2026-02-07');
    expect(dateKey(advanceRecurringDate(due, 'yearly'))).toBe('2027-01-31');
  });
});
