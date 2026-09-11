import type { MobileRecurringRule } from '@faura-farmer/types';
import { advanceRecurringDueDate, recurringSections } from '@/data/recurring';

const baseRule = {
  id: '6fcf9f16-e7a1-4f39-a41b-f34a7d4c5684',
  accountId: '1a1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca',
  userId: 'a230792a-37a8-4c3e-a564-64332ba8eb50',
  categoryId: null,
  label: 'Rent',
  amount: '1500.00',
  type: 'expense',
  frequency: 'monthly',
  nextDueDate: '2026-01-31',
  isActive: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
} satisfies MobileRecurringRule;

describe('recurring rules', () => {
  it('advances one calendar interval and clamps month-end dates', () => {
    expect(advanceRecurringDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(advanceRecurringDueDate('2024-02-29', 'yearly')).toBe('2025-02-28');
    expect(advanceRecurringDueDate('2026-03-25', 'weekly')).toBe('2026-04-01');
  });

  it('pins due rules ahead of future and inactive rules', () => {
    const sections = recurringSections([
      { ...baseRule, id: 'aa1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca', nextDueDate: '2026-04-01' },
      { ...baseRule, id: 'ba1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca', nextDueDate: '2026-03-01' },
      { ...baseRule, id: 'ca1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca', isActive: false },
    ], '2026-03-15');

    expect(sections.due.map((rule) => rule.id)).toEqual(['ba1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca']);
    expect(sections.active.map((rule) => rule.id)).toEqual(['aa1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca']);
    expect(sections.inactive.map((rule) => rule.id)).toEqual(['ca1f8f4c-8842-4b0f-ae44-b2e10ff0f3ca']);
  });
});
