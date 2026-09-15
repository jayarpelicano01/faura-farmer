import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseWorkspace = jest.fn();
const mockUseSync = jest.fn();

jest.mock('@/data/workspace-provider', () => ({ useWorkspace: mockUseWorkspace }));
jest.mock('@/sync/use-sync', () => ({ useSync: mockUseSync }));

const { WorkspaceDataProvider, useWorkspaceData } = require('@/data/hooks/use-workspace-data') as typeof import('@/data/hooks/use-workspace-data');

function Probe() {
  const { accounts, initialLoading, loading, recurringRules } = useWorkspaceData();
  return <Text testID="workspace-data">{`${initialLoading}:${loading}:${accounts.map((account) => account.id).join(',')}:${recurringRules.map((rule) => rule.id).join(',')}`}</Text>;
}

describe('WorkspaceDataProvider', () => {
  it('loads one snapshot and refreshes it after a successful sync', async () => {
    const expectedEntities = ['account', 'budget', 'category', 'debt', 'debt_adjustment', 'debt_cash_event', 'debt_payment', 'monthly_budget', 'person', 'recurring_rule', 'transaction'];
    let syncStatus: 'idle' | 'success' = 'idle';
    const db = {
      getLastSyncedAt: jest.fn().mockResolvedValue(null),
      listRecords: jest.fn((entity: string) => Promise.resolve(entity === 'account'
        ? [{ id: syncStatus === 'success' ? 'account-2' : 'account-1' }]
        : entity === 'recurring_rule' ? [{ id: syncStatus === 'success' ? 'rule-2' : 'rule-1' }] : [])),
    };
    mockUseWorkspace.mockReturnValue({ activeWorkspace: 'online', db });
    mockUseSync.mockImplementation(() => ({ syncStatus }));

    const view = await render(<WorkspaceDataProvider><Probe /></WorkspaceDataProvider>);
    await waitFor(() => expect(screen.getByTestId('workspace-data').props.children).toBe('false:false:account-1:rule-1'));
    expect(db.listRecords.mock.calls.map(([entity]) => entity)).toEqual(expectedEntities);

    syncStatus = 'success';
    await view.rerender(<WorkspaceDataProvider><Probe /></WorkspaceDataProvider>);
    await waitFor(() => expect(screen.getByTestId('workspace-data').props.children).toBe('false:false:account-2:rule-2'));
    expect(db.listRecords.mock.calls.map(([entity]) => entity)).toEqual([...expectedEntities, ...expectedEntities]);
  });
});
