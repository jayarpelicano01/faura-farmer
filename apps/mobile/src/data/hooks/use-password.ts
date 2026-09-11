import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSession } from '@/auth/session';
import { connectionMessage, mobileRequest } from '@/sync/api';

export type PasswordDraft = { currentPassword: string; newPassword: string; confirmPassword: string };

const emptyPasswordDraft: PasswordDraft = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function usePassword(activeSession: () => Promise<{ accessToken: string }>) {
  const router = useRouter();
  const { signOutLocal } = useSession();
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const cancelPasswordEdit = useCallback(() => {
    setPasswordDraft(emptyPasswordDraft);
    setPasswordError(null);
    setEditingPassword(false);
  }, []);
  const updatePassword = useCallback(async () => {
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
  }, [activeSession, passwordDraft, router, signOutLocal]);

  return { cancelPasswordEdit, editingPassword, passwordDraft, passwordError, savingPassword, setEditingPassword, setPasswordDraft, updatePassword };
}
