import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle, useUiStyles } from '@/ui/primitives';

export function OfflineModeCard({ switchToOnline }: { switchToOnline: () => Promise<void> }) {
  const ui = useUiStyles();
  return <Card><SectionTitle>Offline mode</SectionTitle><View style={styles.content}><Text style={ui.listMeta}>Your data stays on this device and never syncs.</Text><Button size="compact" variant="outline" onPress={() => void switchToOnline()}>Switch to online</Button></View></Card>;
}

const styles = StyleSheet.create({ content: { gap: 12, marginTop: 16 } });
