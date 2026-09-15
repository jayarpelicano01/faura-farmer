import { fireEvent, render, screen } from '@testing-library/react-native';

const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: mockRouterReplace }),
}));
jest.mock('lucide-react-native', () => {
  const Icon = () => null;
  return {
    ArrowLeftRight: Icon,
    BarChart3: Icon,
    Check: Icon,
    CircleAlert: Icon,
    CloudOff: Icon,
    HandCoins: Icon,
    LayoutDashboard: Icon,
    Menu: Icon,
    Moon: Icon,
    PiggyBank: Icon,
    Repeat: Icon,
    Sun: Icon,
    Tags: Icon,
    Wallet: Icon,
    X: Icon,
  };
});
jest.mock('@/auth/session', () => ({ useSession: () => ({ session: null }) }));
jest.mock('@/data/workspace-provider', () => ({
  useWorkspace: () => ({
    activeWorkspace: 'local',
    profile: { id: 'local-profile', email: '', name: 'Local', username: 'Jayar' },
  }),
}));
jest.mock('@/sync/use-sync', () => ({ useSync: () => ({ syncMessage: '', syncStatus: 'idle' }) }));
jest.mock('@/ui/brand', () => ({ BrandMark: () => null }));
jest.mock('@/ui/floating-actions', () => ({ FloatingActions: () => null }));
jest.mock('@/ui/primitives', () => ({ AppChromeProvider: ({ children }: any) => children }));
jest.mock('@/ui/theme', () => ({
  useAppTheme: () => ({
    mode: 'light',
    theme: {
      accent: '#eee',
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      foreground: '#111',
      mutedForeground: '#666',
      overlay: '#0008',
      primarySolid: '#000',
      primarySolidForeground: '#fff',
      shadow: '#000',
    },
    toggleMode: jest.fn(),
  }),
  fontFamily: { body: 'System', display: 'System' },
  radius: { control: 8 },
}));

const { AppShell } = require('@/ui/app-shell') as typeof import('@/ui/app-shell');

describe('local profile identity in the app shell', () => {
  it('shows the configured local username in the navigation profile', () => {
    render(<AppShell><></></AppShell>);

    fireEvent.press(screen.getByLabelText('Open navigation menu'));

    expect(screen.getByText('Jayar')).toBeTruthy();
  });
});
