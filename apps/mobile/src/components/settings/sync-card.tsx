import { StyleSheet, Text, View } from 'react-native';
import type { SyncResult } from '@/sync/use-sync';
import { Button, Card, SectionTitle, useUiStyles } from '@/ui/primitives';
import { useAppTheme } from '@/ui/theme';

export function SyncCard({ lastSyncFailed, syncNow }: { lastSyncFailed: boolean; syncNow: (manual?: boolean) => Promise<SyncResult> }) {
  const ui = useUiStyles();
  const { theme } = useAppTheme();
  return <Card><SectionTitle>Data and sync</SectionTitle><View style={styles.content}><Text style={ui.listMeta}>Your app data stays in this device's protected local sandbox and syncs when online.</Text><View style={styles.control}><Button size="full" onPress={() => void syncNow(true)}>Sync now</Button>{lastSyncFailed ? <View pointerEvents="none" style={[styles.dot, { backgroundColor: theme.danger }]} /> : null}</View></View></Card>;
}

const styles = StyleSheet.create({ content: { gap: 12, marginTop: 16 }, control: { alignSelf: 'stretch', position: 'relative' }, dot: { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3 } });
