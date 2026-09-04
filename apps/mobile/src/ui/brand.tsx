import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { fontFamily, useAppTheme } from './theme';

const favicon = require('../../../web/public/favicon.png');

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="Faura Farmer logo"
      source={favicon}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    lockup: { alignItems: 'center', gap: compact ? 8 : 10 },
    wordmark: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: compact ? 15 : 18, fontWeight: '600', letterSpacing: -0.7 },
  }), [compact, theme]);

  return (
    <View style={styles.lockup}>
      <BrandMark size={compact ? 36 : 48} />
      <Text style={styles.wordmark}>Faura-Farmer</Text>
    </View>
  );
}
