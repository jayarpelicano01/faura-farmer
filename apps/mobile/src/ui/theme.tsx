import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';

// These values directly mirror the :root and .dark variables in apps/web/src/app/globals.css.
const themes = {
  light: {
    background: 'hsl(240, 36%, 97%)',
    foreground: 'hsl(200, 26%, 0%)',
    card: 'hsl(240, 33%, 99%)',
    surface: 'hsl(240, 33%, 99%)',
    muted: 'hsl(205, 33%, 95%)',
    mutedForeground: 'hsl(201, 19%, 42%)',
    border: 'hsl(198, 16%, 78%)',
    input: 'hsl(198, 19%, 64%)',
    primary: 'hsl(211, 91%, 30%)',
    primaryForeground: 'hsl(0, 0%, 100%)',
    primarySolid: 'hsl(226, 85%, 8%)',
    primarySolidForeground: 'hsl(0, 0%, 100%)',
    secondary: 'hsl(174, 42%, 92%)',
    secondaryForeground: 'hsl(200, 26%, 25%)',
    accent: 'hsl(211, 85%, 94%)',
    accentForeground: 'hsl(211, 91%, 22%)',
    income: 'hsl(167, 76%, 25%)',
    expense: 'hsl(211, 72%, 26%)',
    danger: 'hsl(8, 64%, 42%)',
    dangerForeground: 'hsl(0, 0%, 100%)',
    overlay: 'rgba(3, 11, 38, 0.36)',
    shadow: 'hsl(226, 85%, 8%)',
  },
  dark: {
    background: 'hsl(210, 22%, 10%)',
    foreground: 'hsl(174, 42%, 92%)',
    card: 'hsl(210, 24%, 16%)',
    surface: 'hsl(210, 24%, 16%)',
    muted: 'hsl(210, 21%, 19%)',
    mutedForeground: 'hsl(198, 19%, 64%)',
    border: 'hsl(210, 24%, 22%)',
    input: 'hsl(206, 21%, 26%)',
    primary: 'hsl(211, 92%, 58%)',
    primaryForeground: 'hsl(211, 91%, 10%)',
    primarySolid: 'hsl(226, 85%, 8%)',
    primarySolidForeground: 'hsl(0, 0%, 100%)',
    secondary: 'hsl(210, 24%, 20%)',
    secondaryForeground: 'hsl(174, 42%, 90%)',
    accent: 'hsl(211, 80%, 18%)',
    accentForeground: 'hsl(211, 85%, 90%)',
    income: 'hsl(167, 70%, 45%)',
    expense: 'hsl(211, 48%, 42%)',
    danger: 'hsl(8, 72%, 62%)',
    dangerForeground: 'hsl(226, 85%, 8%)',
    overlay: 'rgba(3, 14, 49, 0.72)',
    shadow: 'hsl(226, 85%, 8%)',
  },
} as const;

export type AppTheme = (typeof themes)[ThemeMode];

type ThemeContextValue = {
  mode: ThemeMode;
  theme: AppTheme;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const THEME_PREFERENCE_KEY = 'faura-farmer.theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const deviceMode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreference] = useState<ThemeMode | null>(null);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (active && (stored === 'light' || stored === 'dark')) {
          setPreference((current) => current ?? stored);
        }
      })
      .catch(() => {
        // If the encrypted preference cannot be read, continue with the device appearance.
      });
    return () => { active = false; };
  }, []);

  const mode = preference ?? deviceMode;
  const setMode = useCallback((nextMode: ThemeMode) => {
    setPreference(nextMode);
    void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, nextMode).catch(() => {
      // The active session can still use the selection when device storage is unavailable.
    });
  }, []);
  const toggleMode = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);
  const value = useMemo(() => ({ mode, theme: themes[mode], setMode, toggleMode }), [mode, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used within ThemeProvider.');
  return value;
}

export const fontFamily = {
  body: 'AlbertSans',
  display: 'Unbounded',
} as const;

export const radius = {
  card: 12,
  control: 6,
  small: 6,
} as const;
