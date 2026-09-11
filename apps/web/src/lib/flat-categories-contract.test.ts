import { describe, expect, it } from 'vitest';
import { createCategorySchema, mobileCategorySchema } from '@faura-farmer/types';

const category = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Groceries',
  type: 'expense' as const,
  icon: null,
  color: null,
  bucket: 'needs' as const,
  updatedAt: '2026-09-11T00:00:00.000Z',
};

describe('flat category contracts', () => {
  it('rejects parentId in the browser category input shape', () => {
    expect(createCategorySchema.safeParse({ ...category, parentId: '20000000-0000-4000-8000-000000000001' }).success).toBe(false);
  });

  it('accepts Release N mobile category records with omitted or null parentId', () => {
    expect(mobileCategorySchema.safeParse(category).success).toBe(true);
    expect(mobileCategorySchema.safeParse({ ...category, parentId: null }).success).toBe(true);
  });
});
