import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  ArrowDownFromLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  PieChart,
  PiggyBank,
  Plus,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, radius, type AppTheme, useAppTheme } from './theme';

type QuickAction = {
  label: string;
  icon: LucideIcon;
  href: Href;
};

const quickActions: QuickAction[] = [
  { label: 'Log income', icon: ArrowUpFromLine, href: '/transactions?type=income' },
  { label: 'Log expense', icon: ArrowDownFromLine, href: '/transactions?type=expense' },
  { label: 'Log transfer', icon: ArrowLeftRight, href: '/transactions?type=transfer' },
  { label: 'Add account', icon: PiggyBank, href: '/accounts?new=1' },
  { label: 'New budget', icon: Wallet, href: '/budgets?new=1' },
  { label: 'Add category', icon: PieChart, href: '/categories' },
];

function normalizedPathname(pathname: string) {
  const withoutGroups = pathname.replace(/\/\([^/]+\)/g, '').replace(/\/+$/, '');
  return withoutGroups || '/dashboard';
}

export function FloatingActions() {
  const pathname = normalizedPathname(usePathname());
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useFloatingActionStyles(theme);
  const [open, setOpen] = useState(false);
  const itemAnimations = useRef(quickActions.map(() => new Animated.Value(0))).current;
  const closeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const previousPathname = useRef(pathname);

  const closeMenu = useCallback((onClosed?: () => void) => {
    closeAnimation.current?.stop();
    closeAnimation.current = Animated.parallel(
      itemAnimations.map((animation) => Animated.timing(animation, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      })),
    );
    closeAnimation.current.start(() => {
      setOpen(false);
      onClosed?.();
    });
  }, [itemAnimations]);

  const openMenu = useCallback(() => {
    itemAnimations.forEach((animation) => animation.setValue(0));
    setOpen(true);
    requestAnimationFrame(() => {
      closeAnimation.current = Animated.stagger(
        30,
        itemAnimations.map((animation) => Animated.timing(animation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })),
      );
      closeAnimation.current.start();
    });
  }, [itemAnimations]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    closeMenu();
  }, [closeMenu, pathname]);

  useEffect(() => () => closeAnimation.current?.stop(), []);

  if (pathname === '/more') return null;

  const bottom = Math.max(insets.bottom, 16) + 24;
  const selectAction = (action: QuickAction) => closeMenu(() => router.push(action.href));

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {open ? <Pressable accessibilityLabel="Close quick actions" accessibilityRole="button" onPress={() => closeMenu()} style={styles.backdrop} /> : null}

      {open ? (
        <View accessibilityRole="menu" style={[styles.menu, { bottom: bottom + 68 }]}>
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const animation = itemAnimations[index];
            return (
              <Animated.View
                key={action.label}
                style={{
                  opacity: animation,
                  transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                }}
              >
                <Pressable accessibilityLabel={action.label} accessibilityRole="menuitem" onPress={() => selectAction(action)}>
                  {({ pressed }) => (
                    <View style={[styles.menuItem, pressed ? styles.menuItemPressed : undefined]}>
                      <Icon color={theme.primary} size={16} strokeWidth={2} />
                      <Text style={styles.menuLabel}>{action.label}</Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={open ? 'Close quick actions' : 'Open quick actions'}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => (open ? closeMenu() : openMenu())}
        style={[styles.buttonPosition, { bottom }]}
      >
        {({ pressed }) => (
          <View style={[styles.button, open ? styles.buttonOpen : undefined, pressed ? styles.buttonPressed : undefined]}>
            {open ? <X color={theme.primarySolidForeground} size={24} strokeWidth={2.25} /> : <Plus color={theme.primarySolidForeground} size={24} strokeWidth={2.25} />}
          </View>
        )}
      </Pressable>
    </View>
  );
}

function useFloatingActionStyles(theme: AppTheme) {
  return useMemo(() => StyleSheet.create({
    layer: { ...StyleSheet.absoluteFillObject, elevation: 50, zIndex: 50 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.overlay },
    menu: {
      position: 'absolute',
      right: 24,
      width: 204,
      overflow: 'hidden',
      borderCurve: 'continuous',
      borderRadius: radius.card,
      borderColor: theme.border,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: theme.card,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.24,
      shadowRadius: 12,
      elevation: 8,
    },
    menuItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    menuItemPressed: { backgroundColor: theme.accent },
    menuLabel: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    buttonPosition: { position: 'absolute', right: 24 },
    button: {
      width: 60,
      height: 60,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: 'center',
      borderCurve: 'continuous',
      borderRadius: 30,
      backgroundColor: theme.primarySolid,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 10,
    },
    buttonOpen: { backgroundColor: theme.danger },
    buttonPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  }), [theme]);
}
