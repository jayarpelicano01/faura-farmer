import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle, useUiStyles } from '@/ui/primitives';

export function ThemeCard({ mode, toggleMode }: { mode: 'dark' | 'light'; toggleMode: () => void }) {
  const ui = useUiStyles();
  return <Card><SectionTitle>Theme</SectionTitle><View style={styles.content}><Text style={ui.listMeta}>Choose the appearance that is easiest on your eyes.</Text><Button size="compact" variant="outline" onPress={toggleMode}>{mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</Button></View></Card>;
}

const styles = StyleSheet.create({ content: { gap: 12, marginTop: 16 } });
