import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkspace } from '@/data/workspace-provider';
import { useSession } from '@/auth/session';
import { BrandLockup } from '@/ui/brand';
import { BodyText, Button, InlineNotice, Screen } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { isOfflineBuild } from '@/config/app-mode';

export default function WelcomeScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enterOfflineMode } = useWorkspace();
  const { setOffline } = useSession();
  const router = useRouter();
  const styles = useWelcomeStyles();

  const goOffline = async () => {
    setLoading(true);
    setError(null);
    try {
      await enterOfflineMode();
      setOffline();
      router.replace('/dashboard');
    } catch {
      setError('Offline mode is not available on this device.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable>
      <View style={styles.shell}>
        <View style={styles.brand}>
          <BrandLockup />
          <BodyText muted>Your money, tracked from anywhere.</BodyText>
        </View>

        <View style={styles.actions}>
          {error ? <InlineNotice>{error}</InlineNotice> : null}
          {!isOfflineBuild ? <Button size="full" onPress={() => router.push('/login')}>Sign in</Button> : null}
          <Button variant="secondary" size="full" loading={loading} onPress={() => void goOffline()}>
            Use offline
          </Button>
        </View>

        {!isOfflineBuild ? <View style={styles.footer}>
          <Text style={styles.footerText}>No account yet?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/register')}>Register</Text>
        </View> : null}
      </View>
    </Screen>
  );
}

function useWelcomeStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    shell: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24 },
    brand: { alignItems: 'center', gap: 8, marginBottom: 40 },
    actions: { gap: 12 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 28 },
    footerText: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
    footerLink: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  }), [theme]);
}
