import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { mobileRequest, refreshedSession } from '@/sync/api';
import { BodyText, Button, Card, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';

function initialsFor(name?: string | null, email?: string | null) {
  return (name || email || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function MoreScreen() {
  const styles = useMoreStyles();
  const ui = useUiStyles();
  const { session, update, signOutLocal } = useSession();
  const { lastSyncFailed, syncNow } = useSync();
  const router = useRouter();
  const initials = initialsFor(session?.user.name, session?.user.email);

  const logout = async () => {
    try {
      if (session) {
        const active = new Date(session.accessTokenExpiresAt).getTime() <= Date.now() ? await refreshedSession(session) : session;
        if (active !== session) await update(active);
        await mobileRequest('/api/mobile/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: active.refreshToken }) }, active.accessToken);
      }
    } catch {
      // Local logout is still required to protect cached data when the server is unavailable.
    } finally {
      await signOutLocal();
      router.replace('/login');
    }
  };

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <View style={styles.pageHeading}>
          <Title>Profile</Title>
          <BodyText muted>Manage this device and your local data.</BodyText>
        </View>

        <Card>
          <View style={styles.profileRow}>
            <View accessibilityLabel="Your initials" style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={ui.listTitle}>{session?.user.name || 'Your profile'}</Text>
              <Text numberOfLines={1} style={ui.listMeta}>{session?.user.email}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <SectionTitle>Data and sync</SectionTitle>
          <View style={styles.sectionCopy}>
            <Text style={ui.listTitle}>This device</Text>
            <Text style={ui.listMeta}>Your app data is encrypted in a local sandbox and protected by your device lock.</Text>
          </View>
          <View style={styles.syncControl}>
            <Button size="full" onPress={() => void syncNow(true)}>Sync now</Button>
            {lastSyncFailed ? <View pointerEvents="none" style={styles.syncRetryDot} /> : null}
          </View>
        </Card>

        {/* <Card>
          <SectionTitle>Manage</SectionTitle>
          <Link href="/categories" asChild>
            <Pressable accessibilityHint="Open category management" accessibilityRole="link" style={({ pressed }) => [styles.managementRow, pressed ? styles.rowPressed : undefined]}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>C</Text>
              </View>
              <View style={styles.managementCopy}>
                <Text style={ui.listTitle}>Categories</Text>
                <Text style={ui.listMeta}>Manage income and expense categories</Text>
              </View>
              <Text style={styles.openText}>Open</Text>
            </Pressable>
          </Link>
        </Card> */}

        <View style={styles.signOutSection}>
          <Text style={styles.signOutHint}>Signing out removes access to this device until you sign in again.</Text>
          <Button size="full" variant="destructive" onPress={() => void logout()}>Log out of this device</Button>
        </View>
      </View>
    </Screen>
  );
}

function useMoreStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
  content: { gap: 4, paddingBottom: 28 },
  pageHeading: { gap: 0, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 21, backgroundColor: theme.primarySolid },
   avatarText: { color: theme.primarySolidForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700' },
   profileCopy: { flex: 1, gap: 2 },
   sectionCopy: { gap: 4, marginBottom: 16 },
   syncControl: { alignSelf: 'stretch', position: 'relative' },
   syncRetryDot: { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.danger },
   managementRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderCurve: 'continuous', borderRadius: 8, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 10 },
  categoryBadge: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 17, backgroundColor: theme.accent },
  categoryBadgeText: { color: theme.primary, fontFamily: fontFamily.display, fontSize: 13, fontWeight: '600' },
  managementCopy: { flex: 1, gap: 2 },
  openText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  signOutSection: { gap: 10, marginTop: 8 },
  signOutHint: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  rowPressed: { backgroundColor: theme.muted, opacity: 0.9 },
  }), [theme]);
}
