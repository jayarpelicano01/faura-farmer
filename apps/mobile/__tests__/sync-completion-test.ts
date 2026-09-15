const mockGetCursor = jest.fn();
const mockOutboxBatch = jest.fn();
const mockReconcileChanges = jest.fn();
const mockResolveOutbox = jest.fn();
const mockTakeLastSyncError = jest.fn();
const mockGetStoredSession = jest.fn();
const mockMobileRequest = jest.fn();
const mockRefreshedSession = jest.fn();

jest.mock('@/data/db', () => ({
  getCursor: mockGetCursor,
  outboxBatch: mockOutboxBatch,
  reconcileChanges: mockReconcileChanges,
  resolveOutbox: mockResolveOutbox,
  takeLastSyncError: mockTakeLastSyncError,
}));
jest.mock('@/auth/session', () => ({ getStoredSession: mockGetStoredSession }));
jest.mock('@/sync/api', () => ({
  mobileRequest: mockMobileRequest,
  refreshedSession: mockRefreshedSession,
}));

const { synchronize } = require('@/sync/sync') as typeof import('@/sync/sync');

const session = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
  refreshToken: 'refresh-token',
  user: { id: 'user-id', email: 'user@example.com', name: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStoredSession.mockResolvedValue(session);
  mockOutboxBatch.mockResolvedValue([]);
  mockGetCursor.mockResolvedValue('0');
  mockReconcileChanges.mockResolvedValue(undefined);
  mockResolveOutbox.mockResolvedValue(undefined);
  mockTakeLastSyncError.mockResolvedValue(null);
});

it('waits for an automatic sync, then performs a fresh pull for a restore', async () => {
  let releaseAutomaticPull!: () => void;
  const automaticPull = new Promise<{ cursor: string; changes: []; hasMore: false }>((resolve) => {
    releaseAutomaticPull = () => resolve({ cursor: '0', changes: [], hasMore: false });
  });
  mockMobileRequest
    .mockReturnValueOnce(automaticPull)
    .mockResolvedValue({ cursor: '1', changes: [], hasMore: false });

  const automatic = synchronize(jest.fn());
  await new Promise<void>((resolve) => setImmediate(resolve));

  const restore = synchronize(jest.fn(), { ensureFreshPull: true });
  expect(mockMobileRequest).toHaveBeenCalledTimes(1);

  releaseAutomaticPull();

  await expect(restore).resolves.toEqual({ ok: true, warning: null });
  await expect(automatic).resolves.toEqual({ ok: true, warning: null });
  expect(mockMobileRequest).toHaveBeenCalledTimes(2);
  expect(mockReconcileChanges).toHaveBeenLastCalledWith([], '1');

  await expect(synchronize(jest.fn())).resolves.toEqual({ ok: true, warning: null });
  expect(mockMobileRequest).toHaveBeenCalledTimes(3);
});
