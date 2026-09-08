import { useMemo } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Redirect, Slot, usePathname } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/auth/session';
import { WorkspaceProvider, useWorkspace } from '@/data/workspace-provider';
import { SyncProvider } from '@/sync/use-sync';
import { BrandLockup } from '@/ui/brand';
import { AppShell } from '@/ui/app-shell';
import { Button } from '@/ui/primitives';
import { fontFamily, ThemeProvider, useAppTheme } from '@/ui/theme';
import { CurrencyProvider } from '@/ui/currency';
import '../global.css';

function PrivacyCover() {
  const { theme } = useAppTheme();
  const styles = useRootStyles();
  return (
    <View style={[styles.privacyCover, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

function LockScreen() {
  const { unlock } = useSession();
  const styles = useRootStyles();
  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.lockScreen}>
      <View style={styles.lockContent}>
        <BrandLockup />
        <Text style={styles.lockTitle}>Your finances are locked</Text>
        <Text style={styles.lockBody}>Unlock with biometrics or your device passcode to continue.</Text>
        <Button accessibilityLabel="Unlock this device" size="constrained" onPress={() => void unlock()}>Unlock this device</Button>
      </View>
    </SafeAreaView>
  );
}

function Gate() {
  const { status } = useSession();
  const { activeWorkspace } = useWorkspace();
  const pathname = usePathname();
  const { theme } = useAppTheme();
  const styles = useRootStyles();
  if (status === 'loading') return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;
  if (status === 'covered') return <PrivacyCover />;
  if (status === 'locked') return <LockScreen />;
  if (activeWorkspace === 'local') return <AppShell><Slot /></AppShell>;
  if (status === 'signedOut' && pathname !== '/welcome' && pathname !== '/login' && pathname !== '/register') return <Redirect href="/welcome" />;
  if (status === 'signedOut') return <Slot />;
  return <AppShell><Slot /></AppShell>;
}

function RootContent({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: Error | null }) {
  const { mode, theme } = useAppTheme();
  const styles = useRootStyles();

  if (!fontsLoaded && !fontError) return <View style={styles.loading}><ActivityIndicator color={theme.primary} /></View>;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <SessionProvider><WorkspaceProvider><CurrencyProvider><SyncProvider><Gate /></SyncProvider></CurrencyProvider></WorkspaceProvider></SessionProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AlbertSans: require('../assets/fonts/AlbertSans-Variable.ttf'),
    Unbounded: require('../assets/fonts/Unbounded-Variable.ttf'),
  });

  return (
    <ThemeProvider>
      <RootContent fontsLoaded={fontsLoaded} fontError={fontError} />
    </ThemeProvider>
  );
}

function useRootStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background },
    privacyCover: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
    lockScreen: { flex: 1, backgroundColor: theme.background },
    lockContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    lockTitle: { marginTop: 32, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 22, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' },
    lockBody: { marginTop: 12, marginBottom: 28, maxWidth: 290, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  }), [theme]);
}
