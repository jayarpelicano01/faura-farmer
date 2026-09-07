import { afterEach, describe, expect, it, vi } from 'vitest';
import { mobileSyncFailure } from './sync-failure';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mobileSyncFailure', () => {
  it('returns a safe, traceable pull error without exposing the underlying error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = mobileSyncFailure('pull', 'change_feed', Object.assign(new Error('database details must stay private'), { code: 'P2021' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Mobile sync is temporarily unavailable. Please try again.',
      code: 'SYNC_PULL_FAILED',
      requestId: expect.any(String),
    });
    expect(logged).toHaveBeenCalledWith('Mobile sync failed', expect.objectContaining({
      operation: 'pull', stage: 'change_feed', errorCode: 'P2021',
    }));
  });
});
