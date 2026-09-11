import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockOnlineDb = {
  clearLocalData: jest.fn(),
  getProfileDetails: jest.fn(),
  initializeDatabase: jest.fn(),
  saveProfileDetails: jest.fn(),
};
const mockLocalDb = {
  clearLocalData: jest.fn(),
  getProfileDetails: jest.fn(),
  initializeDatabase: jest.fn(),
  saveProfileDetails: jest.fn(),
};
const mockGetActiveWorkspaceId = jest.fn();
const mockSetActiveWorkspaceId = jest.fn();

jest.mock('@/data/db', () => ({
  createDatabase: (name: string) => name === 'faura-farmer-local.db' ? mockLocalDb : mockOnlineDb,
}));
jest.mock('@/data/workspace', () => ({
  LOCAL_PROFILE_ID: 'local-profile',
  LOCAL_WORKSPACE: { id: 'local', label: 'Local only', databaseName: 'faura-farmer-local.db' },
  ONLINE_WORKSPACE: { id: 'online', label: 'Online', databaseName: 'faura-farmer.db' },
  getActiveWorkspaceId: mockGetActiveWorkspaceId,
  setActiveWorkspaceId: mockSetActiveWorkspaceId,
}));

const { WorkspaceProvider, useWorkspace } = require('@/data/workspace-provider') as typeof import('@/data/workspace-provider');

let workspaceControls: ReturnType<typeof useWorkspace> | null = null;

function WorkspaceProbe() {
  workspaceControls = useWorkspace();
  return <Text testID="workspace">{workspaceControls.activeWorkspace}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  workspaceControls = null;
  mockGetActiveWorkspaceId.mockResolvedValue('online');
  mockOnlineDb.initializeDatabase.mockResolvedValue(undefined);
  mockLocalDb.initializeDatabase.mockResolvedValue(undefined);
  mockLocalDb.getProfileDetails.mockResolvedValue(null);
});

describe('offline workspace switching', () => {
  it('preserves the local database while switching to online and clears it only on local logout', async () => {
    await render(<WorkspaceProvider><WorkspaceProbe /></WorkspaceProvider>);
    await waitFor(() => expect(screen.getByTestId('workspace').props.children).toBe('online'));

    await act(async () => { await workspaceControls?.enterOfflineMode(); });
    expect(screen.getByTestId('workspace').props.children).toBe('local');
    expect(mockLocalDb.saveProfileDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-profile' }));
    expect(mockSetActiveWorkspaceId).toHaveBeenLastCalledWith('local');

    await act(async () => { await workspaceControls?.resetToOnline(); });
    expect(screen.getByTestId('workspace').props.children).toBe('online');
    expect(mockLocalDb.clearLocalData).not.toHaveBeenCalled();
    expect(mockSetActiveWorkspaceId).toHaveBeenLastCalledWith('online');

    await act(async () => { await workspaceControls?.enterOfflineMode(); });
    await act(async () => { await workspaceControls?.deleteLocalProfile(); });
    expect(mockLocalDb.clearLocalData).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('workspace').props.children).toBe('online');
    expect(mockSetActiveWorkspaceId).toHaveBeenLastCalledWith('online');
  });
});
