import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

export function SignOutSection({ activeWorkspace, logout }: { activeWorkspace: 'local' | 'online'; logout: () => Promise<void> }) {
  const { theme } = useAppTheme();
  return <View style={styles.section}><Text style={[styles.hint, { color: theme.mutedForeground }]}>{activeWorkspace === 'local' ? 'This will clear all offline data from this device.' : 'Signing out removes access to this device until you sign in again.'}</Text><Button size="full" variant="destructive" onPress={() => void logout()}>Log out of this device</Button></View>;
}

const styles = StyleSheet.create({ section: { gap: 10, marginTop: 8 }, hint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, textAlign: 'center' } });
