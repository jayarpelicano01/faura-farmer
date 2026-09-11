import type { Dispatch, SetStateAction } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PasswordDraft } from '@/data/hooks/use-password';
import { Button, Card, Field, InlineNotice, SectionTitle, useUiStyles } from '@/ui/primitives';
import { fontFamily, useAppTheme } from '@/ui/theme';

type PasswordCardProps = {
  editingPassword: boolean;
  passwordDraft: PasswordDraft;
  passwordError: string | null;
  savingPassword: boolean;
  setEditingPassword: (editing: boolean) => void;
  setPasswordDraft: Dispatch<SetStateAction<PasswordDraft>>;
  cancelPasswordEdit: () => void;
  updatePassword: () => Promise<void>;
};

export function PasswordCard(props: PasswordCardProps) {
  const ui = useUiStyles();
  const styles = useStyles();
  if (!props.editingPassword) return <Card><SectionTitle>Change password</SectionTitle><View style={styles.content}><Text style={ui.listMeta}>Your password is set and secure.</Text><Button size="compact" variant="outline" onPress={() => props.setEditingPassword(true)}>Change password</Button></View></Card>;
  return <Card><SectionTitle>Change password</SectionTitle><View style={styles.form}>
    {props.passwordError ? <InlineNotice>{props.passwordError}</InlineNotice> : null}
    <Field label="Current password" autoComplete="current-password" onChangeText={(currentPassword) => props.setPasswordDraft((current) => ({ ...current, currentPassword }))} secureTextEntry value={props.passwordDraft.currentPassword} />
    <Field label="New password" autoComplete="new-password" onChangeText={(newPassword) => props.setPasswordDraft((current) => ({ ...current, newPassword }))} secureTextEntry value={props.passwordDraft.newPassword} />
    <Field label="Confirm new password" autoComplete="new-password" onChangeText={(confirmPassword) => props.setPasswordDraft((current) => ({ ...current, confirmPassword }))} secureTextEntry value={props.passwordDraft.confirmPassword} />
    <Text style={styles.hint}>Use at least 8 characters with uppercase, lowercase, number, and special characters.</Text>
    <View style={styles.actions}><Button loading={props.savingPassword} size="full" onPress={() => void props.updatePassword()}>{props.savingPassword ? 'Updating password…' : 'Update password'}</Button><Button disabled={props.savingPassword} variant="outline" onPress={props.cancelPasswordEdit}>Cancel</Button></View>
  </View></Card>;
}

function useStyles() { const { theme } = useAppTheme(); return StyleSheet.create({ content: { gap: 12, marginTop: 16 }, form: { gap: 0, marginTop: 16 }, hint: { marginTop: -8, marginBottom: 16, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17 }, actions: { gap: 12, marginTop: 8 } }); }
