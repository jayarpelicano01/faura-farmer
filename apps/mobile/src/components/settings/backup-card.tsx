import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { BackupEntityCounts, BackupRestorePreview } from '@faura-farmer/types';
import { createMobileBackup, previewLocalMobileBackup, restoreLocalMobileBackup } from '@/backup/financial';
import type { DatabaseHandle, PendingBackupRestore } from '@/data/db';
import { connectionMessage, mobileRequest } from '@/sync/api';
import type { SyncResult } from '@/sync/use-sync';
import { Button, Card, InlineNotice, SectionTitle, useUiStyles } from '@/ui/primitives';
import { useAppTheme } from '@/ui/theme';

type ActiveSession = () => Promise<{ accessToken: string }>;

type BackupCardProps = {
  activeSession: ActiveSession;
  activeWorkspace: 'local' | 'online';
  db: DatabaseHandle;
  reload: () => Promise<boolean>;
  syncNow: (manual?: boolean) => Promise<SyncResult>;
};

type RestoreCandidate = {
  file: string;
  preview: BackupRestorePreview;
  workspace: 'local' | 'online';
};

function backupFileName() {
  return `faura-farmer-backup-${new Date().toISOString().slice(0, 10)}.faura-backup.json`;
}

function summary(counts: BackupEntityCounts) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return 'no new records';
  return entries.map(([entity, count]) => `${count} ${entity.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ');
}

export function BackupCard({ activeSession, activeWorkspace, db, reload, syncNow }: BackupCardProps) {
  const ui = useUiStyles();
  const styles = useStyles();
  const [busy, setBusy] = useState<'export' | 'download' | 'import' | 'restore' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const [restorePhase, setRestorePhase] = useState<'idle' | 'importing' | 'syncing'>('idle');
  const [pendingSync, setPendingSync] = useState<{ restoredNotice: string; successNotice: string } | null>(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;
    const pendingRestore = typeof db.getPendingBackupRestore === 'function'
      ? db.getPendingBackupRestore()
      : Promise.resolve(null);
    void pendingRestore.then((pending) => {
      if (!mounted) return;
      setCandidate(null);
      setPendingSync(null);
      if (!pending || pending.workspace !== activeWorkspace) return;
      if (pending.stage === 'preview-ready') {
        setCandidate({ file: pending.file, preview: pending.preview, workspace: pending.workspace });
      } else {
        setPendingSync({
          restoredNotice: pending.restoredNotice ?? 'Backup restored to your account.',
          successNotice: pending.successNotice ?? `Backup restored successfully: ${summary(pending.preview.willAdd)}.`,
        });
        setNotice(`${pending.restoredNotice ?? 'Backup restored to your account.'} The backup is restored to your account but not yet downloaded.`);
      }
    }).catch((error) => {
      if (mounted) setNotice(connectionMessage(error));
    }).finally(() => {
      if (mounted) setHydrating(false);
    });
    return () => { mounted = false; };
  }, [activeWorkspace, db]);

  async function savePendingRestore(
    restore: RestoreCandidate,
    stage: PendingBackupRestore['stage'],
    notices?: Pick<PendingBackupRestore, 'restoredNotice' | 'successNotice'>,
  ) {
    await db.savePendingBackupRestore({
      backupId: restore.preview.backupId,
      entityCounts: restore.preview.willAdd,
      file: restore.file,
      preview: restore.preview,
      savedAt: new Date().toISOString(),
      workspace: restore.workspace,
      stage,
      ...notices,
    });
  }

  async function downloadRestoredData(restoredNotice: string, successNotice: string) {
    setRestorePhase('syncing');
    let result: SyncResult;
    try {
      result = await syncNow(true);
    } catch {
      result = { ok: false, warning: 'Sync needs attention.' };
    }
    if (!result?.ok) {
      setRestorePhase('idle');
      setPendingSync({ restoredNotice, successNotice });
      setNotice(`${restoredNotice} The backup is restored to your account but not yet downloaded.`);
      return;
    }
    try {
      if (!await reload()) throw new Error('The restored data could not be loaded on this device.');
      await db.clearPendingBackupRestore();
    } catch {
      setRestorePhase('idle');
      setPendingSync({ restoredNotice, successNotice });
      setNotice(`${restoredNotice} The backup is restored to your account but not yet downloaded.`);
      return;
    }
    setRestorePhase('idle');
    setPendingSync(null);
    setNotice(successNotice);
  }

  async function exportBackup() {
    setBusy('export');
    setNotice(null);
    let fileUri: string | null = null;
    try {
      const backup = await createMobileBackup(db);
      if (!FileSystem.cacheDirectory) throw new Error('The device cache is unavailable for backup export.');
      fileUri = `${FileSystem.cacheDirectory}${backupFileName()}`;
      await FileSystem.writeAsStringAsync(fileUri, backup.json, { encoding: FileSystem.EncodingType.UTF8 });
      if (!await Sharing.isAvailableAsync()) throw new Error('Sharing backups is unavailable on this device.');
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save or share your Faura Farmer backup' });
      setNotice(backup.pendingChangeCount > 0
        ? `Backup exported with ${backup.pendingChangeCount} unsynced change${backup.pendingChangeCount === 1 ? '' : 's'}${backup.latestPendingChangeAt ? ` from ${new Date(backup.latestPendingChangeAt).toLocaleString()}` : ''}.`
        : 'Backup exported successfully.');
    } catch (error) {
      setNotice(connectionMessage(error));
    } finally {
      if (fileUri) await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      setBusy(null);
    }
  }

  async function downloadBackup() {
    setBusy('download');
    setNotice(null);
    let fileUri: string | null = null;
    try {
      const backup = await createMobileBackup(db);
      const fileName = backupFileName();
      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          setNotice('Backup download canceled.');
          return;
        }
        const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/json',
        );
        await FileSystem.writeAsStringAsync(destinationUri, backup.json, { encoding: FileSystem.EncodingType.UTF8 });
        setNotice(`Backup saved as ${fileName}.`);
        return;
      }

      if (!FileSystem.cacheDirectory) throw new Error('The device cache is unavailable for backup export.');
      fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, backup.json, { encoding: FileSystem.EncodingType.UTF8 });
      if (!await Sharing.isAvailableAsync()) throw new Error('Saving backups is unavailable on this device.');
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save backup to Files' });
      setNotice(`Choose Save to Files to keep ${fileName}.`);
    } catch (error) {
      setNotice(connectionMessage(error));
    } finally {
      if (fileUri) await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      setBusy(null);
    }
  }

  async function restoreCandidate() {
    if (!candidate || !candidate.preview.canRestore) return;
    setBusy('restore');
    setNotice(null);
    setPendingSync(null);
    try {
      if (candidate.workspace === 'local') {
        const result = await restoreLocalMobileBackup(db, candidate.file);
        if (!await reload()) throw new Error('The restored data could not be loaded on this device.');
        await db.clearPendingBackupRestore();
        setCandidate(null);
        setRestorePhase('idle');
        setNotice(`Backup restored locally: ${summary(result.added)}. No data was sent or queued for sync.`);
        return;
      }
      setRestorePhase('importing');
      const session = await activeSession();
      const result = await mobileRequest<{ receipt: { entityCounts: BackupEntityCounts }; duplicate: boolean }>(
        '/api/backup/import',
        { method: 'POST', body: JSON.stringify({ action: 'confirm', file: candidate.file }) },
        session.accessToken,
      );
      const restoredNotice = result.duplicate ? 'This backup was already restored.' : 'Backup restored to your account.';
      const successNotice = `Backup restored successfully: ${summary(candidate.preview.willAdd)}.`;
      await savePendingRestore(candidate, 'account-restored', { restoredNotice, successNotice });
      setCandidate(null);
      await downloadRestoredData(restoredNotice, successNotice);
    } catch (error) {
      setRestorePhase('idle');
      setNotice(connectionMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function retryRestoredData() {
    if (!pendingSync) return;
    setBusy('restore');
    setNotice(null);
    try {
      await downloadRestoredData(pendingSync.restoredNotice, pendingSync.successNotice);
    } catch (error) {
      setRestorePhase('idle');
      setNotice(connectionMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function cancelCandidate() {
    try {
      await db.clearPendingBackupRestore();
      setCandidate(null);
      setNotice(null);
    } catch (error) {
      setNotice(connectionMessage(error));
    }
  }

  async function importBackup() {
    setBusy('import');
    setNotice(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected || !selected.name.endsWith('.faura-backup.json')) throw new Error('Choose a .faura-backup.json file.');
      const file = await FileSystem.readAsStringAsync(selected.uri, { encoding: FileSystem.EncodingType.UTF8 });
      if (activeWorkspace === 'local') {
        const preview = await previewLocalMobileBackup(db, file);
        const restore = { file, preview: preview.restore, workspace: 'local' as const };
        await savePendingRestore(restore, 'preview-ready');
        setCandidate(restore);
        setNotice(`Restoring will add ${summary(preview.restore.willAdd)}.`);
        return;
      }
      const session = await activeSession();
      const serverPreview = await mobileRequest<BackupRestorePreview>(
        '/api/backup/import',
        { method: 'POST', body: JSON.stringify({ action: 'preview', file }) },
        session.accessToken,
      );
      const restore = { file, preview: serverPreview, workspace: 'online' as const };
      await savePendingRestore(restore, 'preview-ready');
      setCandidate(restore);
      setNotice(`Restoring will add ${summary(serverPreview.willAdd)}.`);
    } catch (error) {
      setNotice(connectionMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <Card><SectionTitle>Backup &amp; restore</SectionTitle><View style={styles.content}>
    <Text style={ui.listMeta}>Export a portable copy of your financial data. Restores are additive and protected by the destination account.</Text>
    {notice ? <InlineNotice tone="info">{notice}</InlineNotice> : null}
    {restorePhase === 'importing' ? <InlineNotice tone="info">Restoring to your account...</InlineNotice> : null}
    {restorePhase === 'syncing' ? <InlineNotice tone="info">Downloading restored data...</InlineNotice> : null}
    <Button loading={busy === 'export'} disabled={busy !== null || hydrating} size="full" onPress={() => void exportBackup()}>{busy === 'export' ? 'Preparing backup...' : 'Export backup'}</Button>
    <Button loading={busy === 'download'} disabled={busy !== null || hydrating} size="full" variant="outline" onPress={() => void downloadBackup()}>{busy === 'download' ? 'Saving backup...' : Platform.OS === 'android' ? 'Download backup' : 'Save backup file'}</Button>
    <Button loading={busy === 'import'} disabled={busy !== null || hydrating} size="full" variant="outline" onPress={() => void importBackup()}>{busy === 'import' ? 'Reading backup...' : 'Restore backup'}</Button>
    {pendingSync ? <Button loading={busy === 'restore'} disabled={busy !== null} size="full" variant="outline" onPress={() => void retryRestoredData()}>Sync restored data</Button> : null}
    {candidate ? <View style={styles.pending}>
      <Text style={ui.listMeta}>Restoring will add {summary(candidate.preview.willAdd)}.</Text>
      <Text style={ui.listMeta}>Already present: {summary(candidate.preview.alreadyPresent)}.</Text>
      {candidate.preview.conflicts.map((conflict) => <Text key={conflict.code} style={styles.conflict}>{conflict.message}</Text>)}
      <View style={styles.actions}>
        <Button loading={busy === 'restore'} disabled={busy !== null || !candidate.preview.canRestore} size="compact" variant="outline" onPress={() => void restoreCandidate()}>{busy === 'restore' ? 'Restoring...' : 'Restore additions'}</Button>
        <Button disabled={busy !== null} size="compact" variant="outline" onPress={() => void cancelCandidate()}>Cancel</Button>
      </View>
    </View> : null}
  </View></Card>;
}

function useStyles() {
  const { theme } = useAppTheme();
  return StyleSheet.create({
    content: { gap: 12, marginTop: 16 },
    pending: { gap: 10, borderColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 12 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    conflict: { color: theme.danger, fontSize: 13, lineHeight: 19 },
  });
}
