import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockActiveSession = jest.fn();
const mockDocumentPicker = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockMobileRequest = jest.fn();
const mockSyncNow = jest.fn();
const mockReload = jest.fn();
const mockGetPendingBackupRestore = jest.fn();
const mockSavePendingBackupRestore = jest.fn();
const mockClearPendingBackupRestore = jest.fn();
let finishImport!: () => void;

jest.mock('expo-document-picker', () => ({ getDocumentAsync: mockDocumentPicker }));
jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: mockReadAsStringAsync,
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/backup/financial', () => ({
  createMobileBackup: jest.fn(),
  previewLocalMobileBackup: jest.fn(),
  restoreLocalMobileBackup: jest.fn(),
}));
jest.mock('@/sync/api', () => ({
  connectionMessage: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
  mobileRequest: mockMobileRequest,
}));
jest.mock('@/ui/theme', () => ({
  useAppTheme: () => ({ theme: { border: '#ddd', danger: '#d00' } }),
}));
jest.mock('@/ui/primitives', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    Button: ({ children, onPress }: any) => <Pressable onPress={onPress}><Text>{children}</Text></Pressable>,
    Card: ({ children }: any) => <View>{children}</View>,
    InlineNotice: ({ children }: any) => <Text>{children}</Text>,
    SectionTitle: ({ children }: any) => <Text>{children}</Text>,
    useUiStyles: () => ({ listMeta: {} }),
  };
});

const BackupCard = require('@/components/settings/backup-card').BackupCard as typeof import('@/components/settings/backup-card').BackupCard;

const preview = {
  backupId: '11111111-1111-4111-8111-111111111111',
  willAdd: { accounts: 1, categories: 0, transactions: 0, budgets: 0, monthlyBudgets: 0, recurringRules: 0, persons: 0, debts: 0, debtAdjustments: 0, debtPayments: 0, debtCashEvents: 0 },
  alreadyPresent: { accounts: 0, categories: 0, transactions: 0, budgets: 0, monthlyBudgets: 0, recurringRules: 0, persons: 0, debts: 0, debtAdjustments: 0, debtPayments: 0, debtCashEvents: 0 },
  conflicts: [],
  canRestore: true,
};

function renderCard() {
  return render(<BackupCard
    activeSession={mockActiveSession}
    activeWorkspace="online"
    db={{
      getPendingBackupRestore: mockGetPendingBackupRestore,
      savePendingBackupRestore: mockSavePendingBackupRestore,
      clearPendingBackupRestore: mockClearPendingBackupRestore,
    } as never}
    reload={mockReload}
    syncNow={mockSyncNow}
  />);
}

async function selectAndConfirm() {
  await act(async () => { fireEvent.press(screen.getByText('Restore backup')); });
  await waitFor(() => expect(screen.getAllByText('Restoring will add 1 accounts.').length).toBeGreaterThan(0));
  await act(async () => { fireEvent.press(screen.getByText('Restore additions')); });
  await waitFor(() => expect(screen.getByText('Restoring to your account...')).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockActiveSession.mockResolvedValue({ accessToken: 'access-token' });
  mockDocumentPicker.mockResolvedValue({ canceled: false, assets: [{ name: 'restore.faura-backup.json', uri: 'file://restore' }] });
  mockReadAsStringAsync.mockResolvedValue('{"backupId":"backup"}');
  mockMobileRequest.mockImplementation((_path: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (body.action === 'preview') return Promise.resolve(preview);
    return new Promise((resolve) => {
      finishImport = () => resolve({ receipt: { entityCounts: preview.willAdd }, duplicate: false });
    });
  });
  mockReload.mockResolvedValue(true);
  mockGetPendingBackupRestore.mockResolvedValue(null);
  mockSavePendingBackupRestore.mockResolvedValue(undefined);
  mockClearPendingBackupRestore.mockResolvedValue(undefined);
});

describe('online backup restore card', () => {
  it('waits for download and reload before showing restore success', async () => {
    let finishSync!: (result: { ok: boolean; warning: string | null }) => void;
    mockSyncNow.mockReturnValue(new Promise((resolve) => { finishSync = resolve; }));

    renderCard();
    await selectAndConfirm();

    expect(mockSavePendingBackupRestore).toHaveBeenNthCalledWith(1, expect.objectContaining({ stage: 'preview-ready', workspace: 'online', file: '{"backupId":"backup"}' }));
    expect(screen.getByText('Restoring to your account...')).toBeTruthy();
    await act(async () => { finishImport(); });
    await waitFor(() => expect(screen.getByText('Downloading restored data...')).toBeTruthy());
    expect(mockSavePendingBackupRestore).toHaveBeenNthCalledWith(2, expect.objectContaining({ stage: 'account-restored', workspace: 'online' }));
    expect(mockReload).not.toHaveBeenCalled();
    expect(screen.queryByText(/Backup restored successfully/)).toBeNull();

    await act(async () => { finishSync({ ok: true, warning: null }); });
    await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Backup restored successfully: 1 accounts.')).toBeTruthy();
    expect(mockClearPendingBackupRestore).toHaveBeenCalledTimes(1);
  });

  it('offers a device retry when the account restore succeeds but sync fails', async () => {
    mockSyncNow
      .mockResolvedValueOnce({ ok: false, warning: 'Sync needs attention.' })
      .mockResolvedValueOnce({ ok: true, warning: null });

    renderCard();
    await selectAndConfirm();
    await act(async () => { finishImport(); });

    await waitFor(() => expect(screen.getByText(/restored to your account but not yet downloaded/i)).toBeTruthy());
    expect(screen.getByText('Sync restored data')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByText('Sync restored data')); });
    await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Backup restored successfully: 1 accounts.')).toBeTruthy();
    expect(mockMobileRequest).toHaveBeenCalledTimes(2);
  });

  it('rehydrates a preview after the card is remounted', async () => {
    mockGetPendingBackupRestore.mockResolvedValue({
      backupId: preview.backupId,
      entityCounts: preview.willAdd,
      file: '{"backupId":"backup"}',
      preview,
      savedAt: '2026-09-15T00:00:00.000Z',
      workspace: 'online',
      stage: 'preview-ready',
    });

    renderCard();

    await waitFor(() => expect(screen.getByText('Restore additions')).toBeTruthy());
    expect(screen.getAllByText('Restoring will add 1 accounts.').length).toBeGreaterThan(0);
  });

  it('resumes an account-restored backup without importing it again', async () => {
    mockGetPendingBackupRestore.mockResolvedValue({
      backupId: preview.backupId,
      entityCounts: preview.willAdd,
      file: '{"backupId":"backup"}',
      preview,
      savedAt: '2026-09-15T00:00:00.000Z',
      workspace: 'online',
      stage: 'account-restored',
      restoredNotice: 'Backup restored to your account.',
      successNotice: 'Backup restored successfully: 1 accounts.',
    });
    mockSyncNow.mockResolvedValue({ ok: true, warning: null });

    renderCard();

    await waitFor(() => expect(screen.getByText('Sync restored data')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByText('Sync restored data')); });
    await waitFor(() => expect(screen.getByText('Backup restored successfully: 1 accounts.')).toBeTruthy());
    expect(mockMobileRequest).not.toHaveBeenCalled();
    expect(mockClearPendingBackupRestore).toHaveBeenCalledTimes(1);
  });
});
