import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { MobileProfile } from '@faura-farmer/types';
import { useSession } from '@/auth/session';
import { useWorkspace } from '@/data/workspace-provider';
import { connectionMessage, mobileRequest } from '@/sync/api';
import { useCurrency } from '@/ui/currency';

export type ProfileDraft = { name: string; username: string };

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
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    username: null,
    hasPassword: false,
    displayCurrency: 'PHP',
    usdPerPhp: null,
    rateDate: null,
    rateRefreshedAt: null,
  };
}

function draftFor(profile: MobileProfile): ProfileDraft {
  return { name: profile.name ?? '', username: profile.username ?? '' };
}

type UseProfileOptions = {
  activeSession: () => Promise<NonNullable<ReturnType<typeof useSession>['session']>>;
  profile: MobileProfile | null;
  setProfile: Dispatch<SetStateAction<MobileProfile | null>>;
};

export function useProfile({ activeSession, profile, setProfile }: UseProfileOptions) {
  const { session, update } = useSession();
  const { activeWorkspace, db } = useWorkspace();
  const { setPreference } = useCurrency();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({ name: '', username: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const saveRemoteProfile = useCallback(async (next: MobileProfile) => {
    await db.saveProfileDetails(next);
    await setPreference({
      displayCurrency: next.displayCurrency,
      usdPerPhp: next.usdPerPhp,
      rateDate: next.rateDate,
      rateRefreshedAt: next.rateRefreshedAt,
    });
  }, [db, setPreference]);

  const loadProfileRef = useRef(false);
  const loadProfile = useCallback(async () => {
    if (loadProfileRef.current) return;
    loadProfileRef.current = true;
    try {
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
          // Offline profile storage is best effort.
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
        // The signed-in session remains a safe read-only fallback.
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
    } finally {
      loadProfileRef.current = false;
    }
  }, [activeSession, activeWorkspace, db, saveRemoteProfile, session, setProfile]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const displayedProfile = profile ?? profileFromSession(session);
  const beginProfileEdit = useCallback(() => {
    if (!displayedProfile) return;
    setDraft(draftFor(displayedProfile));
    setProfileError(null);
    setEditingProfile(true);
  }, [displayedProfile]);
  const cancelProfileEdit = useCallback(() => {
    if (displayedProfile) setDraft(draftFor(displayedProfile));
    setEditingProfile(false);
  }, [displayedProfile]);
  const saveProfile = useCallback(async () => {
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
  }, [activeSession, activeWorkspace, db, displayedProfile, draft, saveRemoteProfile, setPreference, setProfile, update]);

  return {
    beginProfileEdit,
    cancelProfileEdit,
    displayedProfile,
    draft,
    initials: initialsFor(displayedProfile?.name, displayedProfile?.email),
    editingProfile,
    loadProfile,
    profileError,
    profileLoading,
    saveProfile,
    savingProfile,
    setDraft,
  };
}
