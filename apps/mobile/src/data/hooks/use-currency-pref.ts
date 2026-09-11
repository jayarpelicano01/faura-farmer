import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { CurrencyPreference, MobileProfile } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { MobileApiError, MobileConnectionError, connectionMessage, mobileRequest } from '@/sync/api';
import { useCurrency } from '@/ui/currency';

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

type UseCurrencyPrefOptions = {
  activeSession: () => Promise<{ accessToken: string }>;
  profile: MobileProfile | null;
  setProfile: Dispatch<SetStateAction<MobileProfile | null>>;
};

export function useCurrencyPref({ activeSession, profile, setProfile }: UseCurrencyPrefOptions) {
  const { activeWorkspace, db } = useWorkspace();
  const { displayCurrency, rateDate, rateRefreshedAt, setPreference, usdPerPhp } = useCurrency();
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currencySuccess, setCurrencySuccess] = useState<string | null>(null);

  const saveRemoteProfile = useCallback(async (next: MobileProfile) => {
    await db.saveProfileDetails(next);
    await setPreference({
      displayCurrency: next.displayCurrency,
      usdPerPhp: next.usdPerPhp,
      rateDate: next.rateDate,
      rateRefreshedAt: next.rateRefreshedAt,
    });
  }, [db, setPreference]);
  const applyPreference = useCallback(async (preference: CurrencyPreference, user: MobileProfile | null = profile) => {
    if (user) {
      const next = { ...user, ...preference };
      await saveRemoteProfile(next);
      setProfile(next);
      return;
    }
    await setPreference(preference);
  }, [profile, saveRemoteProfile, setPreference, setProfile]);
  const changeDisplayCurrency = useCallback(async (next: 'PHP' | 'USD') => {
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
  }, [activeSession, activeWorkspace, applyPreference, db, profile, setPreference, setProfile, usdPerPhp]);
  const refreshRate = useCallback(async () => {
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
  }, [activeSession, applyPreference, displayCurrency]);

  return {
    changeDisplayCurrency,
    currencyError,
    currencySuccess,
    displayCurrency,
    rateDate,
    rateRefreshedAt,
    refreshRate,
    savingCurrency,
    usdPerPhp,
  };
}
