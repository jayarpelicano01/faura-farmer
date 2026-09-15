import { render, screen } from '@testing-library/react-native';
import type { SessionStatus } from '@/auth/session';

let mockStatus: SessionStatus = 'loading';
let mockPathname = '/dashboard';

jest.mock('@/auth/session', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({ status: mockStatus, unlock: jest.fn() }),
}));
jest.mock('@/data/workspace-provider', () => ({ WorkspaceProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/sync/use-sync', () => ({ SyncProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/ui/currency', () => ({ CurrencyProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/ui/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppTheme: () => ({ mode: 'light', theme: { background: '#fff', foreground: '#111', mutedForeground: '#666', primary: '#000' } }),
  fontFamily: { body: 'System', display: 'System' },
}));
jest.mock('@/ui/app-shell', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return { AppShell: ({ children }: { children: React.ReactNode }) => <View><Text>app shell</Text>{children}</View> };
});
jest.mock('@/ui/brand', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { BrandLockup: () => <Text>brand</Text> };
});
jest.mock('@/ui/loading', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { AppLoadingScreen: ({ label }: { label?: string }) => <Text>{label ?? 'Loading Faura Farmer'}</Text> };
});
jest.mock('@/ui/primitives', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Button: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> };
});
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Slot: () => <Text>route slot</Text>,
    usePathname: () => mockPathname,
  };
});

const { Gate } = require('../app/_layout') as typeof import('../app/_layout');

async function renderGate(status: SessionStatus, pathname = '/dashboard') {
  mockStatus = status;
  mockPathname = pathname;
  return render(<Gate />);
}

describe('Gate session routing', () => {
  it('renders the app shell for offline and ready sessions', async () => {
    await renderGate('offline');
    expect(screen.getByText('app shell')).toBeTruthy();
    expect(screen.getByText('route slot')).toBeTruthy();

    await renderGate('ready');
    expect(screen.getByText('app shell')).toBeTruthy();
    expect(screen.getByText('route slot')).toBeTruthy();
  });

  it('keeps signed-out users on auth routes but redirects protected routes to welcome', async () => {
    await renderGate('signedOut', '/login');
    expect(screen.getByText('route slot')).toBeTruthy();
    expect(screen.queryByText('app shell')).toBeNull();

    await renderGate('signedOut', '/dashboard');
    expect(screen.getByText('redirect:/welcome')).toBeTruthy();
  });

  it('gives privacy and lock states precedence over app routing', async () => {
    await renderGate('locked');
    expect(screen.getByText('Unlock this device')).toBeTruthy();
    expect(screen.queryByText('route slot')).toBeNull();

    await renderGate('covered');
    expect(screen.queryByText('route slot')).toBeNull();
    expect(screen.queryByText('app shell')).toBeNull();
  });

  it('uses the branded loading screen while the session is being restored', async () => {
    await renderGate('loading');
    expect(screen.getByText('Opening your finances')).toBeTruthy();
    expect(screen.queryByText('route slot')).toBeNull();
  });
});
