import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockUseSession = jest.fn();
const mockUseWorkspace = jest.fn();

jest.mock('@/auth/session', () => ({ useSession: mockUseSession }));
jest.mock('@/data/workspace-provider', () => ({ useWorkspace: mockUseWorkspace }));

const { CurrencyProvider, useCurrency } = require('@/ui/currency') as typeof import('@/ui/currency');

const onlineProfile = {
  displayCurrency: 'PHP' as const,
  usdPerPhp: null,
  rateDate: null,
  rateRefreshedAt: null,
};
const localProfile = {
  ...onlineProfile,
  displayCurrency: 'USD' as const,
  usdPerPhp: '0.018',
  rateDate: '2026-09-11',
  rateRefreshedAt: '2026-09-11T00:00:00.000Z',
};

function CurrencyProbe() {
  const { displayCurrency, ready } = useCurrency();
  return <Text testID="currency-state">{`${ready}:${displayCurrency}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSession.mockReturnValue({ session: { user: { id: 'online-user' } } });
});

describe('CurrencyProvider local workspace handling', () => {
  it('keeps the provider ready while switching to local mode and then reads the local preference', async () => {
    let resolveOnlineProfile: (profile: { id: string } & typeof onlineProfile) => void;
    const onlineProfilePromise = new Promise<{ id: string } & typeof onlineProfile>((resolve) => { resolveOnlineProfile = resolve; });
    const onlineDb = { getProfileDetails: jest.fn().mockReturnValue(onlineProfilePromise), saveProfileDetails: jest.fn() };
    let resolveLocalProfile: (profile: typeof localProfile) => void;
    const localProfilePromise = new Promise<typeof localProfile>((resolve) => { resolveLocalProfile = resolve; });
    const localDb = { getProfileDetails: jest.fn().mockReturnValue(localProfilePromise), saveProfileDetails: jest.fn() };

    mockUseWorkspace.mockReturnValue({ activeWorkspace: 'online', db: onlineDb });
    const view = await render(<CurrencyProvider><CurrencyProbe /></CurrencyProvider>);
    await act(async () => {
      resolveOnlineProfile!({ id: 'online-user', ...onlineProfile });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('currency-state').props.children).toBe('true:PHP'));

    mockUseWorkspace.mockReturnValue({ activeWorkspace: 'local', db: localDb });
    await view.rerender(<CurrencyProvider><CurrencyProbe /></CurrencyProvider>);
    expect(screen.getByTestId('currency-state').props.children).toBe('true:PHP');

    await act(async () => {
      resolveLocalProfile!(localProfile);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId('currency-state').props.children).toBe('true:USD'));
  });
});
