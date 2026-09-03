import { describe, expect, it } from 'vitest';
import { mobileSyncPushSchema } from '@faura-farmer/types';

describe('mobile sync contract', () => {
  it('accepts a UUID idempotency key and serialized cursor', () => {
    const parsed = mobileSyncPushSchema.safeParse({
      baseCursor: '42',
      mutations: [{
        mutationId: 'd8d9019d-61af-4d0a-9331-1761e017b98c', entity: 'account', recordId: '8eab2672-d5a9-4483-8fa5-072561cbd1d4', operation: 'delete', baseCursor: '42',
      }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unsafe numeric cursor input', () => {
    const parsed = mobileSyncPushSchema.safeParse({ baseCursor: 42, mutations: [] });
    expect(parsed.success).toBe(false);
  });
});
