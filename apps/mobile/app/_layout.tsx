import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Redirect, Slot, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/auth/session';
import { useSync } from '@/sync/use-sync';
import { BrandLockup } from '@/ui/brand';
import { AppShell } from '@/ui/app-shell';
import { fontFamily, theme } from '@/ui/theme';
import '../global.css';

function LockScreen() {
  const { unlock } = useSession();
  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.lockScreen}>
      <View style={styles.lockContent}>
        <BrandLockup />
        <Text style={styles.lockTitle}>Your finances are locked</Text>
        <Text style={styles.lockBody}>Unlock with biometrics or your device passcode to continue.</Text>
        <Pressable accessibilityRole="button" onPress={() => void unlock()} style={({ pressed }) => [styles.unlockButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.unlockButtonText}>Unlock this device</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Gate() {
  const { status } = useSession();
  const pathname = usePathname();
  useSync();
  if (status === 'loading') return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;
  if (status === 'locked') return <LockScreen />;
  if (status === 'signedOut' && pathname !== '/login' && pathname !== '/register') return <Redirect href="/login" />;
  if (status === 'signedOut') return <Slot />;
  return <AppShell><Slot /></AppShell>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AlbertSans: require('../assets/fonts/AlbertSans-Variable.ttf'),
    Unbounded: require('../assets/fonts/Unbounded-Variable.ttf'),
  });

  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />
      <SessionProvider><Gate /></SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
  lockScreen: { flex: 1, backgroundColor: theme.background },
  lockContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  lockTitle: { marginTop: 32, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 22, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' },
  lockBody: { marginTop: 12, maxWidth: 290, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  unlockButton: { width: '100%', maxWidth: 300, marginTop: 28, borderCurve: 'continuous', borderRadius: 8, backgroundColor: theme.primarySolid, paddingHorizontal: 20, paddingVertical: 14 },
  unlockButtonText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
