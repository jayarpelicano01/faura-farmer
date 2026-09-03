import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { asStoredSession, connectionMessage, register } from '@/sync/api';
import { BrandLockup } from '@/ui/brand';
import { BodyText, Button, Card, Field, InlineNotice, Screen } from '@/ui/primitives';
import { fontFamily, theme } from '@/ui/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { establish } = useSession();
  const router = useRouter();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await establish(asStoredSession(await register(email, password, confirm, name || undefined)));
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
          <AuthMode mode="register" />
          <View style={styles.form}>
            {error ? <InlineNotice>{error}</InlineNotice> : null}
            <Field autoComplete="name" label="Name" placeholder="Your name" value={name} onChangeText={setName} />
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
              autoComplete="new-password"
              label="Password"
              placeholder="Create a strong password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Text style={styles.passwordHint}>Use 8+ characters with uppercase, lowercase, a number, and a special character.</Text>
            <Field
              autoComplete="new-password"
              label="Confirm password"
              placeholder="Re-enter your password"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
            <Button disabled={saving} onPress={() => void submit()}>
              {saving ? 'Creating account…' : 'Create account'}
            </Button>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/login" asChild>
              <Pressable accessibilityRole="link" style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Sign in</Text>
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
      <Link href="/login" asChild>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'login' }}
          style={({ pressed }) => [styles.modeTab, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.modeTabText}>Sign in</Text>
        </Pressable>
      </Link>
      <View accessibilityRole="tab" accessibilityState={{ selected: mode === 'register' }} style={[styles.modeTab, mode === 'register' ? styles.modeTabActive : undefined]}>
        <Text style={[styles.modeTabText, mode === 'register' ? styles.modeTabTextActive : undefined]}>Register</Text>
      </View>
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
  passwordHint: { marginTop: -8, marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 20 },
  footerText: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
  footerLink: { minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  footerLinkText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});
