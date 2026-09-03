import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { asStoredSession, connectionMessage, signIn } from '@/sync/api';
import { BrandLockup } from '@/ui/brand';
import { BodyText, Button, Card, Field, InlineNotice, Screen } from '@/ui/primitives';
import { fontFamily, theme } from '@/ui/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { establish } = useSession();
  const router = useRouter();

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

  return (
    <Screen scrollable>
      <View style={styles.shell}>
        <View style={styles.brand}>
          <BrandLockup />
          <BodyText muted>Your money, tracked from anywhere.</BodyText>
        </View>

        <Card>
          <AuthMode mode="login" />
          <View style={styles.form}>
            {error ? <InlineNotice>{error}</InlineNotice> : null}
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
            <Button disabled={saving} onPress={() => void submit()}>
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
        </Card>
      </View>
    </Screen>
  );
}

function AuthMode({ mode }: { mode: 'login' | 'register' }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Authentication mode" style={styles.modeTabs}>
      <View accessibilityRole="tab" accessibilityState={{ selected: mode === 'login' }} style={[styles.modeTab, mode === 'login' ? styles.modeTabActive : undefined]}>
        <Text style={[styles.modeTabText, mode === 'login' ? styles.modeTabTextActive : undefined]}>Sign in</Text>
      </View>
      <Link href="/register" asChild>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'register' }}
          style={({ pressed }) => [styles.modeTab, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.modeTabText}>Register</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flexGrow: 1, justifyContent: 'center', paddingBottom: 24 },
  brand: { alignItems: 'center', gap: 8, marginBottom: 30 },
  modeTabs: { flexDirection: 'row', gap: 4, borderCurve: 'continuous', borderRadius: 8, backgroundColor: theme.muted, padding: 4 },
  modeTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 6, paddingHorizontal: 12 },
  modeTabActive: { backgroundColor: theme.primarySolid },
  modeTabText: { color: theme.mutedForeground, fontFamily: fontFamily.display, fontSize: 12, fontWeight: '600' },
  modeTabTextActive: { color: theme.primaryForeground },
  form: { gap: 0, marginTop: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 20 },
  footerText: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
  footerLink: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  footerLinkText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});
