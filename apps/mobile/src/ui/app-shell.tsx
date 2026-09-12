import { useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { ArrowLeftRight, BarChart3, Check, CircleAlert, CloudOff, HandCoins, LayoutDashboard, Menu, Moon, PiggyBank, Repeat, Sun, Tags, Wallet, X, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { useSync } from '@/sync/use-sync';
import { AppChromeProvider } from './primitives';
import { BrandMark } from './brand';
import { FloatingActions } from './floating-actions';
import { fontFamily, radius, type AppTheme, useAppTheme } from './theme';

type NavigationHref = '/dashboard' | '/accounts' | '/transactions' | '/categories' | '/budgets' | '/reports' | '/debts' | '/recurring';
type NavigationItem = { href: NavigationHref; label: string; icon: LucideIcon };

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: PiggyBank },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: Wallet },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/debts', label: 'Debts', icon: HandCoins },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
];

const DRAWER_WIDTH = 256;
const HEADER_HEIGHT = 56;
const SYNC_STATUS_HEIGHT = 28;

function normalizeRoute(pathname: string) {
  const withoutGroups = pathname.replace(/\/\([^/]+\)/g, '').replace(/\/+$/, '');
  return withoutGroups || '/dashboard';
}

function isNavigationItemActive(pathname: string, href: NavigationHref) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = normalizeRoute(usePathname());
  const router = useRouter();
  const { session } = useSession();
  const { syncMessage, syncStatus } = useSync();
  const { mode, theme, toggleMode } = useAppTheme();
  const styles = useShellStyles(theme);
  const transition = useRef(new Animated.Value(0)).current;
  const [drawerVisible, setDrawerVisible] = useState(false);

  const openDrawer = () => {
    setDrawerVisible(true);
    transition.setValue(0);
    requestAnimationFrame(() => {
      Animated.timing(transition, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const closeDrawer = (onClosed?: () => void) => {
    Animated.timing(transition, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setDrawerVisible(false);
      onClosed?.();
    });
  };

  const navigate = (href: NavigationHref | '/more') => {
    closeDrawer(() => router.replace(href as Href));
  };

  const currentLabel = navigationItems.find((item) => isNavigationItemActive(pathname, item.href))?.label ?? (pathname === '/more' ? 'More' : 'Faura-Farmer');
  const userName = session?.user.name?.trim() || session?.user.email || 'Your profile';
  const ThemeIcon = mode === 'dark' ? Sun : Moon;
  const themeLabel = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  const SyncIcon = syncStatus === 'success' ? Check : syncStatus === 'offline' ? CloudOff : CircleAlert;

  return (
    <AppChromeProvider keyboardVerticalOffset={HEADER_HEIGHT + (syncStatus === 'idle' ? 0 : SYNC_STATUS_HEIGHT)}>
      <View style={styles.shell}>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.headerArea}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Open navigation menu" accessibilityRole="button" hitSlop={8} onPress={openDrawer} style={({ pressed }) => [styles.menuButton, pressed ? styles.pressed : undefined]}>
              <Menu color={theme.foreground} size={21} strokeWidth={2} />
            </Pressable>
            <View style={styles.headerBrand} pointerEvents="none">
              <BrandMark size={27} />
              <Text numberOfLines={1} style={styles.headerTitle}>{currentLabel}</Text>
            </View>
            <Pressable accessibilityLabel="Open profile and settings" accessibilityRole="button" hitSlop={8} onPress={() => router.replace('/more')} style={({ pressed }) => []}>
              {({ pressed }) => (
                <View style={[styles.avatarButton, pressed ? styles.pressed : undefined]}>
                  <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>

        {syncStatus !== 'idle' ? (
          <View accessibilityLiveRegion="polite" style={styles.syncStatus}>
            {syncStatus === 'syncing'
              ? <ActivityIndicator color={theme.mutedForeground} size={14} />
              : <SyncIcon color={theme.mutedForeground} size={14} strokeWidth={2} />}
            <Text numberOfLines={1} style={styles.syncStatusText}>{syncMessage}</Text>
          </View>
        ) : null}

        <View style={styles.content}>{children}</View>
        <FloatingActions />

        <Modal animationType="none" onRequestClose={() => closeDrawer()} statusBarTranslucent transparent visible={drawerVisible}>
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.drawer, { transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] }) }] }]}>
              <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.drawerSafeArea}>
                <View style={styles.drawerHeader}>
                  <View style={styles.wordmark}>
                    <BrandMark size={34} />
                    <Text style={styles.wordmarkText}>Faura-Farmer</Text>
                  </View>
                  <Pressable accessibilityLabel="Close navigation menu" accessibilityRole="button" hitSlop={8} onPress={() => closeDrawer()}>
                    {(pressed) =>(
                      <View style={[styles.closeButton, pressed ? styles.pressed : undefined]}>
                        <X color={theme.foreground} size={20} strokeWidth={2} />
                      </View>
                    )}
                  </Pressable>
                </View>

                <View accessibilityRole="menu" style={styles.navigation}>
                  {navigationItems.map((item) => {
                    const active = isNavigationItemActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Pressable
                        key={item.href}
                        accessibilityRole="menuitem"
                        accessibilityState={{ selected: active }}
                        onPress={() => navigate(item.href)}
                      >
                        {({ pressed }) => (
                          <View style={[styles.navigationItem, active ? styles.navigationItemActive : undefined, pressed && !active ? styles.navigationItemPressed : undefined]}>
                            <Icon color={active ? theme.primarySolidForeground : theme.mutedForeground} size={20} strokeWidth={2} />
                            <Text style={[styles.navigationLabel, active ? styles.navigationLabelActive : undefined]}>{item.label}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.drawerFooter}>
                  <View style={styles.footerRow}>
                    <Pressable accessibilityLabel="Open profile and settings" accessibilityRole="button" onPress={() => navigate('/more')} style={styles.profileHitTarget}>
                      {({ pressed }) => (
                        <View style={[styles.profileRow, pressed ? styles.profileRowPressed : undefined]}>
                          <View style={styles.profileAvatar}><Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
                          <View style={styles.profileCopy}>
                            <Text numberOfLines={1} style={styles.profileName}>{userName}</Text>
                            <Text numberOfLines={1} style={styles.profileEmail}>{session?.user.email ?? 'Profile and settings'}</Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                    <Pressable accessibilityLabel={themeLabel} accessibilityRole="button" hitSlop={2} onPress={toggleMode}>
                      {({ pressed }) => (
                        <View style={[styles.themeButton, pressed ? styles.themeButtonPressed : undefined]}>
                          <ThemeIcon color={theme.foreground} size={25} strokeWidth={2} />
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>
              </SafeAreaView>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]} />
            <Pressable accessibilityLabel="Close navigation menu" accessibilityRole="button" onPress={() => closeDrawer()} style={styles.backdropPressable} />
          </View>
        </Modal>
      </View>
    </AppChromeProvider>
  );
}

function useShellStyles(theme: AppTheme) {
  return useMemo(() => StyleSheet.create({
    shell: { flex: 1, backgroundColor: theme.background },
    headerArea: { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: theme.card },
    header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
    menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control },
    headerBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minWidth: 0 },
    headerTitle: { flexShrink: 1, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 14, fontWeight: '600', letterSpacing: -0.6 },
    avatarButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 16, backgroundColor: theme.primarySolid },
    avatarText: { color: theme.primarySolidForeground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700' },
    syncStatus: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: theme.muted, paddingHorizontal: 16, paddingVertical: 6 },
    syncStatusText: { flex: 1, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
    content: { flex: 1 },
    modalRoot: { flex: 1, flexDirection: 'row' },
    drawer: { zIndex: 2, width: DRAWER_WIDTH, backgroundColor: theme.card, shadowColor: theme.shadow, shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.42, shadowRadius: 16, elevation: 12 },
    drawerSafeArea: { flex: 1, padding: 16 },
    drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 6 },
    wordmark: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    wordmarkText: { flexShrink: 1, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 16, fontWeight: '600', letterSpacing: -0.7 },
    closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control },
    navigation: { marginTop: 20, gap: 4 },
    navigationItem: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 12 },
    navigationItemActive: { backgroundColor: theme.primarySolid },
    navigationItemPressed: { backgroundColor: theme.accent },
    navigationLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 18, fontWeight: '500' },
    navigationLabelActive: { color: theme.primarySolidForeground },
    drawerFooter: { marginTop: 'auto', borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    profileHitTarget: { flex: 1, minWidth: 0 },
    profileRow: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 8 },
    profileRowPressed: { backgroundColor: theme.accent },
    profileAvatar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 16, backgroundColor: theme.primarySolid },
    profileCopy: { flex: 1, minWidth: 0 },
    profileName: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    profileEmail: { marginTop: 2, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12 },
    themeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control, backgroundColor: 'transparent' },
    themeButtonPressed: { backgroundColor: theme.accent },
    backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0, backgroundColor: theme.overlay },
    backdropPressable: { ...StyleSheet.absoluteFillObject, zIndex: 1, left: DRAWER_WIDTH },
    pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  }), [theme]);
}
