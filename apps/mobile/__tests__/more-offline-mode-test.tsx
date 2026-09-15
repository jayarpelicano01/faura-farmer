import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockRouterReplace = jest.fn();
const mockMobileRequest = jest.fn();
const mockSetPreference = jest.fn();
const mockSyncNow = jest.fn();
const mockReload = jest.fn();
const mockSession = {
  clearOffline: jest.fn(),
  lockDelay: 15,
  session: null as null | { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; user: { id: string; email: string; name: string | null } },
  setLockDelay: jest.fn(),
  signOutLocal: jest.fn(),
  update: jest.fn(),
};
const mockWorkspace = {
  activeWorkspace: 'local' as 'local' | 'online',
  db: {
    getProfileDetails: jest.fn(),
    saveProfileDetails: jest.fn(),
  },
  deleteLocalProfile: jest.fn(),
  resetToOnline: jest.fn(),
};
let resolveLocalProfile: (profile: typeof localProfile) => void;

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockRouterReplace }) }));
jest.mock('@/auth/session', () => ({
  LOCK_DELAY_OPTIONS: [1, 5, 15, 30],
  useSession: () => mockSession,
}));
jest.mock('@/data/workspace-provider', () => ({ useWorkspace: () => mockWorkspace }));
jest.mock('@/data/hooks/use-workspace-data', () => ({ useWorkspaceData: () => ({ reload: mockReload }) }));
jest.mock('@/sync/use-sync', () => ({ useSync: () => ({ lastSyncFailed: false, syncNow: mockSyncNow }) }));
jest.mock('@/ui/currency', () => ({
  useCurrency: () => ({ displayCurrency: 'PHP', rateDate: null, rateRefreshedAt: null, setPreference: mockSetPreference, usdPerPhp: null }),
}));
jest.mock('@/sync/api', () => ({
  MobileApiError: class MobileApiError extends Error { status = 500; },
  MobileConnectionError: class MobileConnectionError extends Error {},
  connectionMessage: () => 'Request failed',
  mobileRequest: mockMobileRequest,
  refreshedSession: jest.fn(),
}));
jest.mock('@/ui/theme', () => ({
  fontFamily: { body: 'System', display: 'System' },
  useAppTheme: () => ({
    mode: 'light',
    theme: { danger: '#d00', mutedForeground: '#666', primarySolid: '#000', primarySolidForeground: '#fff' },
    toggleMode: jest.fn(),
  }),
}));
jest.mock('@/ui/primitives', () => {
  const React = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  return {
    BodyText: ({ children }: any) => <Text>{children}</Text>,
    Button: ({ children, onPress }: any) => <Pressable onPress={onPress}><Text>{children}</Text></Pressable>,
    Card: ({ children }: any) => <View>{children}</View>,
    DropdownSelect: () => null,
    Field: ({ label, onChangeText, value }: any) => <View><Text>{label}</Text><TextInput accessibilityLabel={label} onChangeText={onChangeText} value={value} /></View>,
    InlineNotice: ({ children }: any) => <Text>{children}</Text>,
    Screen: ({ children }: any) => <View>{children}</View>,
    SectionTitle: ({ children }: any) => <Text>{children}</Text>,
    Title: ({ children }: any) => <Text>{children}</Text>,
    useUiStyles: () => ({ listMeta: {}, listTitle: {} }),
  };
});

const MoreScreen = require('../app/(tabs)/more').default as typeof import('../app/(tabs)/more').default;

const localProfile = {
  displayCurrency: 'PHP' as const,
  email: '',
  hasPassword: false,
  id: 'local-profile',
  name: 'Local user',
  rateDate: null,
  rateRefreshedAt: null,
  usdPerPhp: null,
  username: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.session = null;
  mockWorkspace.activeWorkspace = 'local';
  const localProfilePromise = new Promise<typeof localProfile>((resolve) => { resolveLocalProfile = resolve; });
  mockWorkspace.db.getProfileDetails.mockReturnValue(localProfilePromise);
  mockWorkspace.db.saveProfileDetails.mockResolvedValue(undefined);
  mockWorkspace.deleteLocalProfile.mockResolvedValue(undefined);
  mockWorkspace.resetToOnline.mockResolvedValue(undefined);
  mockSetPreference.mockResolvedValue(undefined);
  mockReload.mockResolvedValue(true);
});

async function loadLocalProfile() {
  await act(async () => {
    resolveLocalProfile!(localProfile);
    await Promise.resolve();
  });
}

describe('More screen local-only workspace behavior', () => {
  it('hides server profile fields and switches online without clearing local data', async () => {
    await render(<MoreScreen />);
    await loadLocalProfile();
    await waitFor(() => expect(screen.getByText('Local account')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Edit profile')); });
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Username')).toBeNull();

    await act(async () => { fireEvent.press(screen.getByText('Switch to online')); });
    await waitFor(() => expect(mockWorkspace.resetToOnline).toHaveBeenCalledTimes(1));
    expect(mockSession.clearOffline).toHaveBeenCalledTimes(1);
    expect(mockSession.signOutLocal).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/login');
  });

  it('clears local data only when a local-only user logs out', async () => {
    await render(<MoreScreen />);
    await loadLocalProfile();
    await waitFor(() => expect(screen.getByText('Log out of this device')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Log out of this device')); });
    await waitFor(() => expect(mockWorkspace.deleteLocalProfile).toHaveBeenCalledTimes(1));
    expect(mockSession.clearOffline).toHaveBeenCalledTimes(1);
    expect(mockSession.signOutLocal).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith('/welcome');
  });

  it('does not start a second profile request when the session changes during an in-flight load', async () => {
    let resolveProfile: (value: { user: typeof localProfile }) => void;
    const request = new Promise<{ user: typeof localProfile }>((resolve) => { resolveProfile = resolve; });
    mockWorkspace.activeWorkspace = 'online';
    mockWorkspace.db.getProfileDetails.mockResolvedValue(null);
    mockSession.session = {
      accessToken: 'access-token',
      accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      refreshToken: 'refresh-token',
      user: { id: 'online-user', email: 'user@example.com', name: 'Online user' },
    };
    mockMobileRequest.mockReturnValue(request);

    const view = await render(<MoreScreen />);
    await waitFor(() => expect(mockMobileRequest).toHaveBeenCalledTimes(1));

    mockSession.session = { ...mockSession.session, accessToken: 'refreshed-access-token' };
    await view.rerender(<MoreScreen />);
    expect(mockMobileRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveProfile!({ user: { ...localProfile, id: 'online-user', email: 'user@example.com', name: 'Online user' } });
      await Promise.resolve();
    });
    await waitFor(() => expect(mockWorkspace.db.saveProfileDetails).toHaveBeenCalledTimes(1));
  });
});
