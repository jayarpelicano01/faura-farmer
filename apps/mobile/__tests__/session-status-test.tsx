import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { SessionStatus } from '@/auth/session';

const mockSecureStore = {
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
};
const mockGetActiveWorkspaceId = jest.fn();

jest.mock('expo-secure-store', () => mockSecureStore);
jest.mock('expo-local-authentication', () => ({ authenticateAsync: jest.fn() }));
jest.mock('@/data/db', () => ({ clearLocalData: jest.fn(), getProfile: jest.fn(), saveProfile: jest.fn() }));
jest.mock('@/data/workspace', () => ({ getActiveWorkspaceId: mockGetActiveWorkspaceId }));

const { SessionProvider, useSession } = require('@/auth/session') as typeof import('@/auth/session');

let sessionControls: {
  clearOffline: () => void;
  setOffline: () => void;
  status: SessionStatus;
} | null = null;

function SessionProbe() {
  sessionControls = useSession();
  return <Text testID="session-status">{sessionControls.status}</Text>;
}

function renderSession() {
  return render(<SessionProvider><SessionProbe /></SessionProvider>);
}

function status(view: Awaited<ReturnType<typeof render>>) {
  return view.getByTestId('session-status').props.children as SessionStatus;
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionControls = null;
  mockSecureStore.getItemAsync.mockImplementation(async (key: string) => (
    key === 'mobile-installation-id-v1' ? 'test-device' : null
  ));
  mockGetActiveWorkspaceId.mockResolvedValue('online');
});

describe('local-only session status', () => {
  it('starts offline on a cold launch with a local workspace and no server session', async () => {
    mockGetActiveWorkspaceId.mockResolvedValue('local');
    const view = await renderSession();

    await waitFor(() => expect(status(view)).toBe('offline'));
  });

  it('starts signed out when there is no local workspace or stored server session', async () => {
    const view = await renderSession();

    await waitFor(() => expect(status(view)).toBe('signedOut'));
  });

  it('moves explicitly between signed-out and offline modes', async () => {
    const view = await renderSession();
    await waitFor(() => expect(status(view)).toBe('signedOut'));

    await act(async () => { sessionControls?.setOffline(); });
    expect(status(view)).toBe('offline');

    await act(async () => { sessionControls?.clearOffline(); });
    expect(status(view)).toBe('signedOut');
  });
});
