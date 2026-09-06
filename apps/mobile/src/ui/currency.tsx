import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CurrencyPreference, DisplayCurrency } from '@faura-farmer/types';
import { convertMoney, defaultCurrencyPreference, formatDisplayMoney } from '@faura-farmer/types';
import { getProfileDetails, saveProfileDetails } from '@/data/db';
import { useSession } from '@/auth/session';

type CurrencyContextValue = CurrencyPreference & {
  ready: boolean;
  setPreference: (next: CurrencyPreference) => Promise<void>;
  formatMoney: (value: string | number, sourceCurrency?: string) => string;
  convert: (value: string | number, sourceCurrency: string, targetCurrency?: string) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [preference, setStoredPreference] = useState<CurrencyPreference>(defaultCurrencyPreference);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!session) {
      setStoredPreference(defaultCurrencyPreference);
      setReady(true);
      return () => { active = false; };
    }
    setReady(false);
    void getProfileDetails().then((profile) => {
      if (!active) return;
      if (profile?.id === session.user.id) setStoredPreference(profile);
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [session]);

  const setPreference = useCallback(async (next: CurrencyPreference) => {
    setStoredPreference(next);
    const profile = await getProfileDetails();
    if (profile) await saveProfileDetails({ ...profile, ...next });
  }, []);

  const value = useMemo<CurrencyContextValue>(() => ({
    ...preference,
    ready,
    setPreference,
    formatMoney: (amount, sourceCurrency = preference.displayCurrency) => formatDisplayMoney(amount, sourceCurrency, preference),
    convert: (amount, sourceCurrency, targetCurrency = preference.displayCurrency) => convertMoney(amount, sourceCurrency, targetCurrency, preference.usdPerPhp),
  }), [preference, ready, setPreference]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('useCurrency must be used inside CurrencyProvider');
  return value;
}
