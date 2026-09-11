import { describe, expect, it, vi } from 'vitest';
import { fetchTransferGroupRows } from './transfer-group-fetch';

describe('fetchTransferGroupRows', () => {
  it('fetches incoming legs only for outgoing transfer groups and scopes them to the user', async () => {
    const fetchOutgoing = vi.fn().mockResolvedValue([
      { id: 'ordinary', transferGroupId: null },
      { id: 'outgoing', transferGroupId: 'group-1' },
    ]);
    const fetchIncoming = vi.fn().mockResolvedValue([{ id: 'incoming', transferGroupId: 'group-1' }]);

    const result = await fetchTransferGroupRows({
      userId: 'user-1',
      baseWhere: { userId: 'user-1' },
      fetchOutgoing,
      fetchIncoming,
    });

    expect(result.outgoing).toHaveLength(2);
    expect(result.incoming).toEqual([{ id: 'incoming', transferGroupId: 'group-1' }]);
    expect(fetchIncoming).toHaveBeenCalledWith({
      account: { userId: 'user-1' },
      transferGroupId: { in: ['group-1'] },
      transferRole: 'incoming',
    });
  });

  it('does not query incoming legs when the outgoing rows have no transfer groups', async () => {
    const fetchIncoming = vi.fn();
    const result = await fetchTransferGroupRows({
      userId: 'user-1',
      baseWhere: { userId: 'user-1' },
      fetchOutgoing: vi.fn().mockResolvedValue([{ transferGroupId: null }]),
      fetchIncoming,
    });

    expect(result.incoming).toEqual([]);
    expect(fetchIncoming).not.toHaveBeenCalled();
  });
});
