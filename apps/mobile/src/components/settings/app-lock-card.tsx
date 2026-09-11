import { StyleSheet, Text, View } from 'react-native';
import type { LockDelayMinutes } from '@/auth/session';
import { LOCK_DELAY_OPTIONS } from '@/auth/session';
import { Button, Card, SectionTitle, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

export function AppLockCard({ lockDelay, setLockDelay }: { lockDelay: LockDelayMinutes; setLockDelay: (value: LockDelayMinutes) => Promise<void> }) {
  const ui = useUiStyles();
  const styles = useStyles();
  return <Card><SectionTitle>App lock</SectionTitle><View style={styles.content}>
    <Text style={ui.listMeta}>Require authentication after the app leaves the screen. A privacy cover appears immediately.</Text>
    <View style={styles.options}>{LOCK_DELAY_OPTIONS.map((minutes) => <Button key={minutes} size="compact" variant={lockDelay === minutes ? 'default' : 'outline'} onPress={() => void setLockDelay(minutes)}>{minutes === 1 ? '1 min' : `${minutes} min`}</Button>)}</View>
    <Text style={styles.hint}>Default is 15 minutes. The privacy cover is always immediate.</Text>
  </View></Card>;
}

function useStyles() { const { theme } = useAppTheme(); return StyleSheet.create({ content: { gap: 12, marginTop: 16 }, options: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, hint: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 } }); }
