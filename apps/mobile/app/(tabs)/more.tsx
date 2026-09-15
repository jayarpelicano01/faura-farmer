import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MobileProfile } from '@faura-farmer/types';
import { useSession } from '@/auth/session';
import { OfflineModeCard } from '@/components/settings/offline-mode-card';
import { AppLockCard } from '@/components/settings/app-lock-card';
import { BackupCard } from '@/components/settings/backup-card';
import { CurrencyCard } from '@/components/settings/currency-card';
import { PasswordCard } from '@/components/settings/password-card';
import { ProfileCard } from '@/components/settings/profile-card';
import { SignOutSection } from '@/components/settings/sign-out-section';
import { SyncCard } from '@/components/settings/sync-card';
import { ThemeCard } from '@/components/settings/theme-card';
import { activeSession } from '@/data/active-session';
import { useCurrencyPref } from '@/data/hooks/use-currency-pref';
import { useLogout } from '@/data/hooks/use-logout';
import { usePassword } from '@/data/hooks/use-password';
import { useProfile } from '@/data/hooks/use-profile';
import { useWorkspace } from '@/data/workspace-provider';
import { useWorkspaceData } from '@/data/hooks/use-workspace-data';
import { BodyText, InlineNotice, Screen, Title } from '@/ui/primitives';
import { useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { isOfflineBuild } from '@/config/app-mode';

export default function MoreScreen() {
  const styles = useMoreStyles();
  const { mode, toggleMode } = useAppTheme();
  const { clearOffline, lockDelay, session, setLockDelay, update } = useSession();
  const { activeWorkspace, db, resetToOnline } = useWorkspace();
  const { reload } = useWorkspaceData();
  const { lastSyncFailed, syncNow } = useSync();
  const router = useRouter();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const getActiveSession = useCallback(
    () => activeSession(sessionRef.current, update),
    [update],
  );

  const profileState = useProfile({ activeSession: getActiveSession, profile, setProfile });
  const passwordState = usePassword(getActiveSession);
  const currencyState = useCurrencyPref({ activeSession: getActiveSession, profile, setProfile });
  const logout = useLogout(getActiveSession);
  const switchToOnline = useCallback(async () => {
    await resetToOnline();
    clearOffline();
    router.replace('/login');
  }, [clearOffline, resetToOnline, router]);

  return <Screen scrollable><View style={styles.content}>
    <View style={styles.heading}><Title>Profile</Title><BodyText muted>Manage your profile, security, and this device.</BodyText></View>
    {profileState.profileError ? <InlineNotice>{profileState.profileError}</InlineNotice> : null}
    {activeWorkspace === 'local' && !isOfflineBuild ? <OfflineModeCard switchToOnline={switchToOnline} /> : null}
    <ProfileCard activeWorkspace={activeWorkspace} profile={profile} {...profileState} />
    {profileState.displayedProfile?.hasPassword && activeWorkspace === 'online' ? <PasswordCard {...passwordState} /> : null}
    <ThemeCard mode={mode === 'dark' ? 'dark' : 'light'} toggleMode={toggleMode} />
    <CurrencyCard activeWorkspace={activeWorkspace} {...currencyState} />
    <BackupCard activeSession={getActiveSession} activeWorkspace={activeWorkspace} db={db} reload={reload} syncNow={syncNow} />
    <AppLockCard lockDelay={lockDelay} setLockDelay={setLockDelay} />
    {activeWorkspace === 'online' && !isOfflineBuild ? <SyncCard lastSyncFailed={lastSyncFailed} syncNow={syncNow} /> : null}
    {!isOfflineBuild ? <SignOutSection activeWorkspace={activeWorkspace} logout={logout} /> : null}
  </View></Screen>;
}

function useMoreStyles() {
  return useMemo(() => StyleSheet.create({ content: { gap: 4, paddingBottom: 28 }, heading: { gap: 0, marginBottom: 12 } }), []);
}
