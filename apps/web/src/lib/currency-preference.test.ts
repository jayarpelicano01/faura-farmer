import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@faura-farmer/database', () => ({
  Prisma: {},
  prisma: { user: { findUnique } },
}));

import { loadDisplayPreference } from './currency-preference';

describe('loadDisplayPreference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not read a preference or convert amounts without the display flag', async () => {
    const result = await loadDisplayPreference('https://example.test/api/budgets', 'user-1');

    expect(result.preference).toBeUndefined();
    expect(result.toStorage(125)).toBe(125);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('loads the display preference and converts submitted USD amounts to PHP', async () => {
    findUnique.mockResolvedValue({
      displayCurrency: 'USD',
      usdPerPhp: { toString: () => '0.02' },
      rateDate: new Date('2026-09-11T00:00:00.000Z'),
      rateRefreshedAt: new Date('2026-09-11T01:00:00.000Z'),
    });

    const result = await loadDisplayPreference('https://example.test/api/budgets?display=1', 'user-1');

    expect(result.preference?.displayCurrency).toBe('USD');
    expect(result.toStorage(2)).toBe(100);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }));
  });
});
