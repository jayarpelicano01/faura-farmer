import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseWorkspace = jest.fn();
const mockUseSync = jest.fn();

jest.mock('@/data/workspace-provider', () => ({ useWorkspace: mockUseWorkspace }));
jest.mock('@/sync/use-sync', () => ({ useSync: mockUseSync }));

const { WorkspaceDataProvider, useWorkspaceData } = require('@/data/hooks/use-workspace-data') as typeof import('@/data/hooks/use-workspace-data');

function Probe() {
  const { accounts, loading } = useWorkspaceData();
  return <Text testID="workspace-data">{`${loading}:${accounts.map((account) => account.id).join(',')}`}</Text>;
}

describe('WorkspaceDataProvider', () => {
  it('loads one snapshot and refreshes it after a successful sync', async () => {
    let syncStatus: 'idle' | 'success' = 'idle';
    const db = {
      getLastSyncedAt: jest.fn().mockResolvedValue(null),
      listRecords: jest.fn((entity: string) => Promise.resolve(entity === 'account'
        ? [{ id: syncStatus === 'success' ? 'account-2' : 'account-1' }]
        : [])),
    };
    mockUseWorkspace.mockReturnValue({ activeWorkspace: 'online', db });
    mockUseSync.mockImplementation(() => ({ syncStatus }));

    const view = await render(<WorkspaceDataProvider><Probe /></WorkspaceDataProvider>);
    await waitFor(() => expect(screen.getByTestId('workspace-data').props.children).toBe('false:account-1'));
    expect(db.listRecords).toHaveBeenCalledTimes(5);

    syncStatus = 'success';
    await view.rerender(<WorkspaceDataProvider><Probe /></WorkspaceDataProvider>);
    await waitFor(() => expect(screen.getByTestId('workspace-data').props.children).toBe('false:account-2'));
    expect(db.listRecords).toHaveBeenCalledTimes(10);
  });
});
