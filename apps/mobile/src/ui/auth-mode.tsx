import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fontFamily, radius, useAppTheme } from './theme';

type AuthMode = 'login' | 'register';

const destinations: Record<AuthMode, '/login' | '/register'> = {
  login: '/login',
  register: '/register',
};

export function AuthModeSelector({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const styles = useAuthModeStyles();

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Authentication mode" style={styles.tabs}>
      {(['login', 'register'] as const).map((item) => {
        const selected = item === mode;
        const label = item === 'login' ? 'Sign in' : 'Register';
        return (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => { if (!selected) router.replace(destinations[item]);}}
          >
            {({ pressed }) => (
              <View style={[styles.tab, selected ? styles.tabActive : undefined, pressed && !selected ? styles.pressed : undefined]}>
                <Text style={[styles.tabText, selected ? styles.tabTextActive : undefined]}>{label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function useAuthModeStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    tabs: { flexDirection: 'row', gap: 4, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: theme.muted, padding: 4 },
    tab: { flex: 1, minWidth: '50%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.small, paddingHorizontal: 16 },
    tabActive: { backgroundColor: theme.primarySolid },
    tabText: { color: theme.mutedForeground, fontFamily: fontFamily.display, fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: theme.primarySolidForeground },
    pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  }), [theme]);
}
