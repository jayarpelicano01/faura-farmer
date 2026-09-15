import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@/config/app-mode', () => ({ isOfflineBuild: true }));

const mockOnlineDb = {
  initializeDatabase: jest.fn(),
};
const mockLocalDb = {
  initializeDatabase: jest.fn(),
  getProfileDetails: jest.fn(),
  saveProfileDetails: jest.fn(),
};

jest.mock('@/data/db', () => ({
  createDatabase: (name: string) => name === 'faura-farmer-local.db' ? mockLocalDb : mockOnlineDb,
}));
jest.mock('@/data/workspace', () => ({
  LOCAL_PROFILE_ID: 'local-profile',
  LOCAL_WORKSPACE: { id: 'local', label: 'Local only', databaseName: 'faura-farmer-local.db' },
  ONLINE_WORKSPACE: { id: 'online', label: 'Online', databaseName: 'faura-farmer.db' },
  getActiveWorkspaceId: jest.fn(),
  setActiveWorkspaceId: jest.fn(),
}));

const { WorkspaceProvider, useWorkspace } = require('@/data/workspace-provider') as typeof import('@/data/workspace-provider');

function Probe() {
  const { activeWorkspace, profile } = useWorkspace();
  return <Text testID="workspace">{`${activeWorkspace}:${profile?.name ?? ''}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalDb.getProfileDetails.mockResolvedValue(null);
  mockLocalDb.initializeDatabase.mockResolvedValue(undefined);
  mockLocalDb.saveProfileDetails.mockResolvedValue(undefined);
});

describe('offline-only workspace startup', () => {
  it('initializes only local storage and creates the local profile', async () => {
    render(<WorkspaceProvider><Probe /></WorkspaceProvider>);

    await waitFor(() => expect(screen.getByTestId('workspace').props.children).toBe('local:Local'));
    expect(mockOnlineDb.initializeDatabase).not.toHaveBeenCalled();
    expect(mockLocalDb.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(mockLocalDb.saveProfileDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 'local-profile' }));
  });
});
