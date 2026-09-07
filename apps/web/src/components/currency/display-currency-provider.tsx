'use client';

import { createContext, useContext, useMemo } from 'react';
import { convertMoney, formatDisplayMoney, type CurrencyPreference } from '@faura-farmer/types';

type DisplayCurrencyContextValue = CurrencyPreference & {
  convert: (value: string | number, sourceCurrency: string, targetCurrency?: string) => string;
  formatMoney: (value: string | number, sourceCurrency?: string) => string;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(null);

export function DisplayCurrencyProvider({ children, preference }: { children: React.ReactNode; preference: CurrencyPreference }) {
  const value = useMemo<DisplayCurrencyContextValue>(() => ({
    ...preference,
    convert: (amount, sourceCurrency, targetCurrency = preference.displayCurrency) => convertMoney(amount, sourceCurrency, targetCurrency, preference.usdPerPhp),
    formatMoney: (amount, sourceCurrency = preference.displayCurrency) => formatDisplayMoney(amount, sourceCurrency, preference),
  }), [preference]);

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}

export function useDisplayCurrency() {
  const value = useContext(DisplayCurrencyContext);
  if (!value) throw new Error('useDisplayCurrency must be used inside DisplayCurrencyProvider');
  return value;
}
