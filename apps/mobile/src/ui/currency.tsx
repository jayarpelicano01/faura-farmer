import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CurrencyPreference, DisplayCurrency } from '@faura-farmer/types';
import { convertMoney, defaultCurrencyPreference, formatDisplayMoney } from '@faura-farmer/types';
import { useWorkspace } from '@/data/workspace-provider';
import { useSession } from '@/auth/session';

type CurrencyContextValue = CurrencyPreference & {
  ready: boolean;
  setPreference: (next: CurrencyPreference) => Promise<void>;
  formatMoney: (value: string | number, sourceCurrency?: string, options?: { maximumFractionDigits?: number }) => string;
  compactMoney: (value: string | number, sourceCurrency?: string) => string;
  signedMoney: (value: string | number, sourceCurrency?: string) => string;
  convert: (value: string | number, sourceCurrency: string, targetCurrency?: string) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const { activeWorkspace, db } = useWorkspace();
  const [preference, setStoredPreference] = useState<CurrencyPreference>(defaultCurrencyPreference);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (activeWorkspace === 'local') {
      void db.getProfileDetails().then((profile) => {
        if (!active) return;
        if (profile) setStoredPreference(profile);
        setReady(true);
      }).catch(() => { if (active) setReady(true); });
      return () => { active = false; };
    }

    if (!session) {
      setStoredPreference(defaultCurrencyPreference);
      setReady(true);
      return () => { active = false; };
    }
    setReady(false);
    void db.getProfileDetails().then((profile) => {
      if (!active) return;
      if (profile?.id === session.user.id) setStoredPreference(profile);
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [activeWorkspace, session, db]);

  const setPreference = useCallback(async (next: CurrencyPreference) => {
    setStoredPreference(next);
    const profile = await db.getProfileDetails();
    if (profile) await db.saveProfileDetails({ ...profile, ...next });
  }, [db]);

  const value = useMemo<CurrencyContextValue>(() => ({
    ...preference,
    ready,
    setPreference,
    formatMoney: (amount, sourceCurrency = preference.displayCurrency, options) => {
      if (options?.maximumFractionDigits === undefined) {
        return formatDisplayMoney(amount, sourceCurrency, preference);
      }
      const converted = Number(convertMoney(amount, sourceCurrency, preference.displayCurrency, preference.usdPerPhp));
      const safeAmount = Number.isFinite(converted) ? converted : 0;
      try {
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: preference.displayCurrency,
          maximumFractionDigits: options.maximumFractionDigits,
        }).format(safeAmount);
      } catch {
        return `${preference.displayCurrency} ${safeAmount.toFixed(options.maximumFractionDigits)}`;
      }
    },
    compactMoney: (amount, sourceCurrency = preference.displayCurrency) => {
      const converted = Number(convertMoney(amount, sourceCurrency, preference.displayCurrency, preference.usdPerPhp));
      const safeAmount = Number.isFinite(converted) ? converted : 0;
      const prefix = preference.displayCurrency === 'PHP' ? '₱' : `${preference.displayCurrency} `;
      if (Math.abs(safeAmount) >= 1_000_000) return `${prefix}${(safeAmount / 1_000_000).toFixed(1)}M`;
      if (Math.abs(safeAmount) >= 1_000) return `${prefix}${(safeAmount / 1_000).toFixed(1)}K`;
      return `${prefix}${Math.round(safeAmount)}`;
    },
    signedMoney: (amount, sourceCurrency = preference.displayCurrency) => {
      const converted = Number(convertMoney(amount, sourceCurrency, preference.displayCurrency, preference.usdPerPhp));
      return `${converted > 0 ? '+' : ''}${formatDisplayMoney(amount, sourceCurrency, preference)}`;
    },
    convert: (amount, sourceCurrency, targetCurrency = preference.displayCurrency) => convertMoney(amount, sourceCurrency, targetCurrency, preference.usdPerPhp),
  }), [preference, ready, setPreference]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error('useCurrency must be used inside CurrencyProvider');
  return value;
}
