import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { asStoredSession, connectionMessage, signIn } from '@/sync/api';
import { useWorkspace } from '@/data/workspace-provider';
import { BrandLockup } from '@/ui/brand';
import { AuthModeSelector } from '@/ui/auth-mode';
import { BodyText, Button, Card, Field, InlineNotice, Screen } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authNotice, establish } = useSession();
  const { enterOfflineMode } = useWorkspace();
  const router = useRouter();
  const styles = useLoginStyles();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await establish(asStoredSession(await signIn(email, password)));
      router.replace('/dashboard');
    } catch (caught) {
      setError(connectionMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const goOffline = async () => {
    try {
      await enterOfflineMode();
      router.replace('/dashboard');
    } catch { /* ignore */ }
  };

  return (
    <Screen scrollable>
      <View style={styles.shell}>
        <View style={styles.brand}>
          <BrandLockup />
          <BodyText muted>Your money, tracked from anywhere.</BodyText>
        </View>

        <Card>
          <AuthModeSelector mode="login" />
          <View style={styles.form}>
            {error ?? authNotice ? <InlineNotice>{error ?? authNotice}</InlineNotice> : null}
            <Field
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
            />
            <Field
              autoComplete="current-password"
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button loading={saving} size="full" onPress={() => void submit()}>
              {saving ? 'Signing in…' : 'Sign in'}
            </Button>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <Link href="/register" asChild>
              <Pressable accessibilityRole="link" style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Register</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.altActions}>
            <Pressable style={styles.altLink} onPress={() => void goOffline()}>
              <Text style={styles.altLinkText}>Use offline</Text>
            </Pressable>
            <Text style={styles.altSeparator}>·</Text>
            <Pressable style={styles.altLink} onPress={() => router.replace('/welcome')}>
              <Text style={styles.altLinkText}>Back</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function useLoginStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    shell: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24 },
    brand: { alignItems: 'center', gap: 8, marginBottom: 30 },
    form: { gap: 0, marginTop: 22 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 20 },
    footerText: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
    footerLink: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    footerLinkText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
    altActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, minHeight: 44 },
    altLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    altLinkText: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
    altSeparator: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
  }), [theme]);
}
