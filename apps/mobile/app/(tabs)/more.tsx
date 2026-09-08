import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CurrencyPreference, MobileProfile } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useSession } from '@/auth/session';
import { LOCK_DELAY_OPTIONS, type LockDelayMinutes } from '@/auth/session';
import { MobileApiError, MobileConnectionError, connectionMessage, mobileRequest, refreshedSession } from '@/sync/api';
import { BodyText, Button, Card, DropdownSelect, Field, InlineNotice, Screen, SectionTitle, Title, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';
import { useSync } from '@/sync/use-sync';
import { useCurrency } from '@/ui/currency';

type ProfileDraft = { name: string; username: string };
type PasswordDraft = { currentPassword: string; newPassword: string; confirmPassword: string };

function initialsFor(name?: string | null, email?: string | null) {
  return (name || email || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function profileFromSession(session: ReturnType<typeof useSession>['session']): MobileProfile | null {
  if (!session) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name, username: null, hasPassword: false, displayCurrency: 'PHP', usdPerPhp: null, rateDate: null, rateRefreshedAt: null };
}

function draftFor(profile: MobileProfile): ProfileDraft {
  return { name: profile.name ?? '', username: profile.username ?? '' };
}

const emptyPasswordDraft: PasswordDraft = { currentPassword: '', newPassword: '', confirmPassword: '' };

function rateRefreshMessage(error: unknown) {
  if (error instanceof MobileApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again, then retry the exchange-rate refresh.';
    if (error.status === 429) return 'Rate refresh is temporarily limited. Please wait a moment, then try again.';
    if (error.status >= 500) return 'The exchange-rate service is temporarily unavailable. Please try again.';
  }
  if (error instanceof MobileConnectionError || (error instanceof TypeError && /network|fetch/i.test(error.message))) {
    return 'Couldn’t refresh the exchange rate. Check your connection and try again.';
  }
  if (error instanceof Error && /session has ended/i.test(error.message)) {
    return 'Your session expired. Sign in again, then retry the exchange-rate refresh.';
  }
  return 'Unable to refresh the exchange rate. Please try again.';
}

export default function MoreScreen() {
  const styles = useMoreStyles();
  const ui = useUiStyles();
  const { mode, toggleMode } = useAppTheme();
  const { session, update, signOutLocal, lockDelay, setLockDelay } = useSession();
  const { db, activeWorkspace, resetToOnline } = useWorkspace();
  const { lastSyncFailed, syncNow } = useSync();
  const { displayCurrency, usdPerPhp, rateDate, rateRefreshedAt, setPreference } = useCurrency();
  const router = useRouter();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({ name: '', username: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currencySuccess, setCurrencySuccess] = useState<string | null>(null);

  const activeSession = useCallback(async () => {
    if (!session) throw new Error('Your session has ended');
    if (new Date(session.accessTokenExpiresAt).getTime() - Date.now() >= 60_000) return session;
    const next = await refreshedSession(session);
    await update(next);
    return next;
  }, [session, update]);

  const saveRemoteProfile = useCallback(async (next: MobileProfile) => {
    await db.saveProfileDetails(next);
    await setPreference({
      displayCurrency: next.displayCurrency,
      usdPerPhp: next.usdPerPhp,
      rateDate: next.rateDate,
      rateRefreshedAt: next.rateRefreshedAt,
    });
  }, [db, setPreference]);

  const loadProfile = useCallback(async () => {
    if (activeWorkspace === 'local') {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const cached = await db.getProfileDetails();
        if (cached) {
          setProfile(cached);
          setDraft(draftFor(cached));
        }
      } catch {
        // Offline mode - profile loading failed
      } finally {
        setProfileLoading(false);
      }
      return;
    }

    if (!session) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const cached = await db.getProfileDetails();
      if (cached?.id === session.user.id) {
        setProfile(cached);
        setDraft(draftFor(cached));
      }
    } catch {
      // The signed-in session remains a safe read-only fallback when local storage is unavailable.
    }

    try {
      const active = await activeSession();
      const response = await mobileRequest<{ user: MobileProfile }>('/api/mobile/v1/profile', {}, active.accessToken);
      await saveRemoteProfile(response.user);
      setProfile(response.user);
      setDraft(draftFor(response.user));
    } catch (error) {
      setProfileError(connectionMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }, [activeSession, activeWorkspace, db, saveRemoteProfile, session]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const displayedProfile = profile ?? profileFromSession(session);
  const initials = initialsFor(displayedProfile?.name, displayedProfile?.email);

  const beginProfileEdit = () => {
    if (!displayedProfile) return;
    setDraft(draftFor(displayedProfile));
    setProfileError(null);
    setEditingProfile(true);
  };

  const cancelProfileEdit = () => {
    if (displayedProfile) setDraft(draftFor(displayedProfile));
    setEditingProfile(false);
  };

  const saveProfile = async () => {
    if (!displayedProfile) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      if (activeWorkspace === 'local') {
        const next = { ...displayedProfile, name: draft.name.trim() || null, username: draft.username.trim() || null };
        await db.saveProfileDetails(next);
        await setPreference({
          displayCurrency: next.displayCurrency,
          usdPerPhp: next.usdPerPhp,
          rateDate: next.rateDate,
          rateRefreshedAt: next.rateRefreshedAt,
        });
        setProfile(next);
        setDraft(draftFor(next));
        setEditingProfile(false);
        return;
      }
      const active = await activeSession();
      const response = await mobileRequest<{ user: MobileProfile }>(
        '/api/mobile/v1/profile',
        { method: 'PATCH', body: JSON.stringify({ name: draft.name.trim() || null, username: draft.username.trim() || null }) },
        active.accessToken,
      );
      await saveRemoteProfile(response.user);
      await update({ ...active, user: { ...active.user, name: response.user.name } });
      setProfile(response.user);
      setDraft(draftFor(response.user));
      setEditingProfile(false);
    } catch (error) {
      setProfileError(connectionMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelPasswordEdit = () => {
    setPasswordDraft(emptyPasswordDraft);
    setPasswordError(null);
    setEditingPassword(false);
  };

  const updatePassword = async () => {
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const active = await activeSession();
      await mobileRequest('/api/mobile/v1/profile/password', { method: 'POST', body: JSON.stringify(passwordDraft) }, active.accessToken);
      await signOutLocal();
      router.replace('/login');
    } catch (error) {
      setPasswordError(connectionMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = async () => {
    try {
      if (session) {
        const active = await activeSession();
        await mobileRequest('/api/mobile/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: active.refreshToken }) }, active.accessToken);
      }
    } catch {
      // Local logout is still required to protect cached data when the server is unavailable.
    } finally {
      await signOutLocal();
      router.replace('/welcome');
    }
  };

  const applyPreference = useCallback(async (preference: CurrencyPreference, user: MobileProfile | null = profile) => {
    if (user) {
      const next = { ...user, ...preference };
      await saveRemoteProfile(next);
      setProfile(next);
      return;
    }
    await setPreference(preference);
  }, [profile, saveRemoteProfile, setPreference]);

  const changeDisplayCurrency = async (next: 'PHP' | 'USD') => {
    if (next === 'USD' && !usdPerPhp) {
      setCurrencyError('Refresh the exchange rate while online before switching to USD.');
      return;
    }
    setSavingCurrency(true);
    setCurrencyError(null);
    setCurrencySuccess(null);
    try {
      if (activeWorkspace === 'local') {
        const updated = { displayCurrency: next } as CurrencyPreference;
        await setPreference(updated);
        if (profile) {
          const nextProfile = { ...profile, ...updated };
          await db.saveProfileDetails(nextProfile);
          setProfile(nextProfile);
        }
        return;
      }
      const active = await activeSession();
      const response = await mobileRequest<{ user: MobileProfile }>('/api/mobile/v1/profile', { method: 'PATCH', body: JSON.stringify({ displayCurrency: next }) }, active.accessToken);
      await applyPreference(response.user, response.user);
    } catch (error) {
      setCurrencyError(connectionMessage(error));
    } finally {
      setSavingCurrency(false);
    }
  };

  const refreshRate = async () => {
    setSavingCurrency(true);
    setCurrencyError(null);
    setCurrencySuccess(null);
    try {
      const active = await activeSession();
      const response = await mobileRequest<{ preference: CurrencyPreference }>('/api/mobile/v1/profile/currency-rate', { method: 'POST' }, active.accessToken);
      await applyPreference({ ...response.preference, displayCurrency });
      setCurrencySuccess('Exchange rate refreshed. The latest rate details are now saved on this device.');
    } catch (error) {
      setCurrencyError(rateRefreshMessage(error));
    } finally {
      setSavingCurrency(false);
    }
  };

  const themeLabel = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Screen scrollable>
      <View style={styles.content}>
        <View style={styles.pageHeading}>
          <Title>Profile</Title>
          <BodyText muted>Manage your profile, security, and this device.</BodyText>
        </View>

        {profileError ? <InlineNotice>{profileError}</InlineNotice> : null}

        {activeWorkspace === 'local' ? (
          <Card>
            <SectionTitle>Offline mode</SectionTitle>
            <View style={styles.sectionContent}>
              <Text style={ui.listMeta}>Your data stays on this device and never syncs.</Text>
              <Button size="compact" variant="outline" onPress={async () => { await signOutLocal(); await resetToOnline(); router.replace('/login'); }}>Switch to online</Button>
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Personal information</SectionTitle>
          <View style={styles.profileSummary}>
            <View accessibilityLabel="Your initials" style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={ui.listTitle}>{displayedProfile?.name || 'Your profile'}</Text>
              <Text numberOfLines={1} style={ui.listMeta}>{displayedProfile?.email ?? 'Loading profile...'}</Text>
            </View>
          </View>

          {profileLoading && !profile ? <Text style={ui.listMeta}>Loading your profile…</Text> : null}
          {displayedProfile && !editingProfile ? (
            <View style={styles.details}>
              <ProfileDetail label="Name" value={displayedProfile.name || 'Not set'} />
              <ProfileDetail label="Email" value={displayedProfile.email} />
              <ProfileDetail label="Username" value={displayedProfile.username || 'Not set'} />
              <View style={styles.actionRow}>
                <Button disabled={profileLoading} size="compact" variant="outline" onPress={beginProfileEdit}>Edit profile</Button>
                {profileError ? <Button disabled={profileLoading} size="compact" variant="ghost" onPress={() => void loadProfile()}>Try again</Button> : null}
              </View>
            </View>
          ) : null}

          {displayedProfile && editingProfile ? (
            <View style={styles.form}>
              <Field label="Name" autoComplete="name" maxLength={120} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="Your name" value={draft.name} />
              <Field label="Email" editable={false} value={displayedProfile.email} />
              <Field label="Username" autoCapitalize="none" autoCorrect={false} maxLength={30} onChangeText={(username) => setDraft((current) => ({ ...current, username }))} placeholder="username" value={draft.username} />
              <Text style={styles.fieldHint}>3–30 letters, numbers, dots, dashes, or underscores.</Text>
              <View style={styles.formActions}>
                <Button loading={savingProfile} size="full" onPress={() => void saveProfile()}>{savingProfile ? 'Saving changes…' : 'Save changes'}</Button>
                <Button disabled={savingProfile} variant="outline" onPress={cancelProfileEdit}>Cancel</Button>
              </View>
            </View>
          ) : null}
        </Card>

        {displayedProfile?.hasPassword && activeWorkspace === 'online' ? (
          <Card>
            <SectionTitle>Change password</SectionTitle>
            {!editingPassword ? (
              <View style={styles.sectionContent}>
                <Text style={ui.listMeta}>Your password is set and secure.</Text>
                <Button size="compact" variant="outline" onPress={() => setEditingPassword(true)}>Change password</Button>
              </View>
            ) : (
              <View style={styles.form}>
                {passwordError ? <InlineNotice>{passwordError}</InlineNotice> : null}
                <Field label="Current password" autoComplete="current-password" onChangeText={(currentPassword) => setPasswordDraft((current) => ({ ...current, currentPassword }))} secureTextEntry value={passwordDraft.currentPassword} />
                <Field label="New password" autoComplete="new-password" onChangeText={(newPassword) => setPasswordDraft((current) => ({ ...current, newPassword }))} secureTextEntry value={passwordDraft.newPassword} />
                <Field label="Confirm new password" autoComplete="new-password" onChangeText={(confirmPassword) => setPasswordDraft((current) => ({ ...current, confirmPassword }))} secureTextEntry value={passwordDraft.confirmPassword} />
                <Text style={styles.fieldHint}>Use at least 8 characters with uppercase, lowercase, number, and special characters.</Text>
                <View style={styles.formActions}>
                  <Button loading={savingPassword} size="full" onPress={() => void updatePassword()}>{savingPassword ? 'Updating password…' : 'Update password'}</Button>
                  <Button disabled={savingPassword} variant="outline" onPress={cancelPasswordEdit}>Cancel</Button>
                </View>
              </View>
            )}
          </Card>
        ) : null}

        <Card>
          <SectionTitle>Theme</SectionTitle>
          <View style={styles.sectionContent}>
            <Text style={ui.listMeta}>Choose the appearance that is easiest on your eyes.</Text>
            <Button size="compact" variant="outline" onPress={toggleMode}>{themeLabel}</Button>
          </View>
        </Card>

        <Card>
          <SectionTitle>Display currency</SectionTitle>
          <View style={styles.sectionContent}>
            <Text style={ui.listMeta}>Show amounts in PHP or USD. Your saved balances and transaction history stay unchanged.</Text>
            <DropdownSelect
              label="Currency"
              options={[{ label: 'PHP — Philippine Peso', value: 'PHP' }, { label: 'USD — US Dollar', value: 'USD' }]}
              value={displayCurrency}
              onValueChange={(next) => void changeDisplayCurrency(next as 'PHP' | 'USD')}
              disabled={savingCurrency}
            />
            <Text style={styles.fieldHint}>{usdPerPhp ? `1 PHP = ${usdPerPhp} USD${rateDate ? ` · Rate date ${rateDate}` : ''}${rateRefreshedAt ? ` · refreshed ${new Date(rateRefreshedAt).toLocaleString()}` : ''}` : 'No USD rate is cached on this device.'}</Text>
            {currencyError ? <InlineNotice>{currencyError}</InlineNotice> : null}
            {currencySuccess ? <InlineNotice tone="info">{currencySuccess}</InlineNotice> : null}
            {activeWorkspace === 'online' ? (
              <Button disabled={savingCurrency} size="compact" variant="outline" onPress={() => void refreshRate}>{savingCurrency ? 'Refreshing rate…' : 'Refresh rate'}</Button>
            ) : null}
          </View>
        </Card>

        <Card>
          <SectionTitle>App lock</SectionTitle>
          <View style={styles.sectionContent}>
            <Text style={ui.listMeta}>Require authentication after the app leaves the screen. A privacy cover appears immediately.</Text>
            <View style={styles.lockDelayOptions}>
              {LOCK_DELAY_OPTIONS.map((minutes) => (
                <Button
                  key={minutes}
                  size="compact"
                  variant={lockDelay === minutes ? 'default' : 'outline'}
                  onPress={() => void setLockDelay(minutes)}
                >
                  {minutes === 1 ? '1 min' : minutes === 5 ? '5 min' : minutes === 15 ? '15 min' : '30 min'}
                </Button>
              ))}
            </View>
            <Text style={styles.fieldHint}>Default is 15 minutes. The privacy cover is always immediate.</Text>
          </View>
        </Card>

        {activeWorkspace === 'online' ? (
        <Card>
          <SectionTitle>Data and sync</SectionTitle>
          <View style={styles.sectionContent}>
            <Text style={ui.listMeta}>Your app data stays in this device's protected local sandbox and syncs when online.</Text>
            <View style={styles.syncControl}>
              <Button size="full" onPress={() => void syncNow(true)}>Sync now</Button>
              {lastSyncFailed ? <View pointerEvents="none" style={styles.syncRetryDot} /> : null}
            </View>
          </View>
        </Card>
        ) : null}

        <View style={styles.signOutSection}>
          <Text style={styles.signOutHint}>{activeWorkspace === 'local' ? 'This will clear all offline data from this device.' : 'Signing out removes access to this device until you sign in again.'}</Text>
          <Button size="full" variant="destructive" onPress={() => void logout()}>Log out of this device</Button>
        </View>
      </View>
    </Screen>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  const ui = useUiStyles();
  const styles = useMoreStyles();
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text numberOfLines={1} style={ui.listTitle}>{value}</Text></View>;
}

function useMoreStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    content: { gap: 4, paddingBottom: 28 },
    pageHeading: { gap: 0, marginBottom: 12 },
    profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 16 },
    avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 21, backgroundColor: theme.primarySolid },
    avatarText: { color: theme.primarySolidForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700' },
    profileCopy: { flex: 1, gap: 2, minWidth: 0 },
    details: { gap: 12 },
    detail: { gap: 2 },
    detailLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, fontWeight: '500' },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    form: { gap: 0, marginTop: 16 },
    fieldHint: { marginTop: -8, marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
    formActions: { gap: 12, marginTop: 8 },
    sectionContent: { gap: 12, marginTop: 16 },
    currencyActions: { flexDirection: 'row', gap: 10 },
    workspaceOptions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    lockDelayOptions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    syncControl: { alignSelf: 'stretch', position: 'relative' },
    syncRetryDot: { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.danger },
    signOutSection: { gap: 10, marginTop: 8 },
    signOutHint: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  }), [theme]);
}
