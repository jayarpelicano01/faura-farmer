import { Image, Text, View } from 'react-native';
import { fontFamily, theme } from './theme';

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
  return (
    <View style={{ alignItems: 'center', gap: compact ? 8 : 10 }}>
      <BrandMark size={compact ? 36 : 48} />
      <Text
        style={{ color: theme.foreground, fontFamily: fontFamily.display, fontSize: compact ? 15 : 18, fontWeight: '600', letterSpacing: -0.7 }}
      >
        Faura-Farmer
      </Text>
    </View>
  );
}
