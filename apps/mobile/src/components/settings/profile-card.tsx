import type { Dispatch, SetStateAction } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MobileProfile } from '@faura-farmer/types';
import type { ProfileDraft } from '@/data/hooks/use-profile';
import { Button, Card, Field, SectionTitle, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

type ProfileCardProps = {
  activeWorkspace: 'local' | 'online';
  beginProfileEdit: () => void;
  cancelProfileEdit: () => void;
  displayedProfile: MobileProfile | null;
  draft: ProfileDraft;
  editingProfile: boolean;
  initials: string;
  loadProfile: () => Promise<void>;
  profile: MobileProfile | null;
  profileError: string | null;
  profileLoading: boolean;
  saveProfile: () => Promise<void>;
  savingProfile: boolean;
  setDraft: Dispatch<SetStateAction<ProfileDraft>>;
};

export function ProfileCard(props: ProfileCardProps) {
  const ui = useUiStyles();
  const styles = useStyles();
  const {
    activeWorkspace, beginProfileEdit, cancelProfileEdit, displayedProfile, draft,
    editingProfile, initials, loadProfile, profile, profileError, profileLoading,
    saveProfile, savingProfile, setDraft,
  } = props;
  return (
    <Card>
      <SectionTitle>Personal information</SectionTitle>
      <View style={styles.summary}>
        <View accessibilityLabel="Your initials" style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={ui.listTitle}>{displayedProfile?.name || 'Your profile'}</Text>
          <Text numberOfLines={1} style={ui.listMeta}>{activeWorkspace === 'local' ? 'Local account' : (displayedProfile?.email ?? 'Loading profile...')}</Text>
        </View>
      </View>
      {profileLoading && !profile ? <Text style={ui.listMeta}>Loading profile…</Text> : null}
      {displayedProfile && !editingProfile ? <View style={styles.details}>
        <ProfileDetail label="Name" value={displayedProfile.name || 'Not set'} />
        {activeWorkspace === 'online' ? <ProfileDetail label="Email" value={displayedProfile.email} /> : null}
        {activeWorkspace === 'online' ? <ProfileDetail label="Username" value={displayedProfile.username || 'Not set'} /> : null}
        <View style={styles.actions}>
          <Button disabled={profileLoading} size="compact" variant="outline" onPress={beginProfileEdit}>Edit profile</Button>
          {profileError ? <Button disabled={profileLoading} size="compact" variant="ghost" onPress={() => void loadProfile()}>Try again</Button> : null}
        </View>
      </View> : null}
      {displayedProfile && editingProfile ? <View style={styles.form}>
        <Field label="Name" autoComplete="name" maxLength={120} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="Your name" value={draft.name} />
        {activeWorkspace === 'online' ? <Field label="Email" editable={false} value={displayedProfile.email} /> : null}
        {activeWorkspace === 'online' ? <>
          <Field label="Username" autoCapitalize="none" autoCorrect={false} maxLength={30} onChangeText={(username) => setDraft((current) => ({ ...current, username }))} placeholder="username" value={draft.username} />
          <Text style={styles.hint}>3–30 letters, numbers, dots, dashes, or underscores.</Text>
        </> : null}
        <View style={styles.formActions}>
          <Button loading={savingProfile} size="full" onPress={() => void saveProfile()}>{savingProfile ? 'Saving changes…' : 'Save changes'}</Button>
          <Button disabled={savingProfile} variant="outline" onPress={cancelProfileEdit}>Cancel</Button>
        </View>
      </View> : null}
    </Card>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  const ui = useUiStyles();
  const styles = useStyles();
  return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text numberOfLines={1} style={ui.listTitle}>{value}</Text></View>;
}

function useStyles() {
  const { theme } = useAppTheme();
  return StyleSheet.create({
    summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
    avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: theme.primarySolid },
    avatarText: { color: theme.primarySolidForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '700' },
    copy: { flex: 1, gap: 2, minWidth: 0 }, details: { gap: 12 }, detail: { gap: 2 },
    label: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, fontWeight: '500' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }, form: { gap: 0, marginTop: 16 },
    hint: { marginTop: -8, marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 },
    formActions: { gap: 12, marginTop: 8 },
  });
}
