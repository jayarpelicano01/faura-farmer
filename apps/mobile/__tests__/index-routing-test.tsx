import { render, screen, waitFor } from '@testing-library/react-native';

let mockStatus = 'ready';
const mockGetPendingBackupRestore = jest.fn();

jest.mock('@/auth/session', () => ({ useSession: () => ({ status: mockStatus }) }));
jest.mock('@/data/workspace-provider', () => ({ useWorkspace: () => ({ activeWorkspace: 'online', db: { getPendingBackupRestore: mockGetPendingBackupRestore } }) }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));

const Index = require('../app/index').default as typeof import('../app/index').default;

describe('initial restore-aware routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'ready';
  });

  it('opens More when a pending restore exists', async () => {
    mockGetPendingBackupRestore.mockResolvedValue({ stage: 'preview-ready', workspace: 'online' });

    render(<Index />);

    await waitFor(() => expect(screen.getByText('redirect:/more')).toBeTruthy());
  });

  it('keeps the normal Dashboard destination without a pending restore', async () => {
    mockGetPendingBackupRestore.mockResolvedValue(null);

    render(<Index />);

    await waitFor(() => expect(screen.getByText('redirect:/dashboard')).toBeTruthy());
  });
});
