import { useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { ArrowLeftRight, LayoutDashboard, Menu, PiggyBank, Tags, X, type LucideIcon } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { AppChromeProvider } from './primitives';
import { BrandMark } from './brand';
import { fontFamily, radius, theme } from './theme';

type NavigationHref = '/dashboard' | '/accounts' | '/transactions' | '/categories';
type NavigationItem = { href: NavigationHref; label: string; icon: LucideIcon };

const navigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: PiggyBank },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categories', icon: Tags },
];

const DRAWER_WIDTH = 292;

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

  return (
    <AppChromeProvider>
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
            <Pressable accessibilityLabel="Open profile and settings" accessibilityRole="button" hitSlop={8} onPress={() => router.replace('/more')} style={({ pressed }) => [styles.avatarButton, pressed ? styles.pressed : undefined]}>
              <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        <View style={styles.content}>{children}</View>

        <Modal animationType="none" onRequestClose={() => closeDrawer()} statusBarTranslucent transparent visible={drawerVisible}>
          <View style={styles.modalRoot}>
            <Animated.View style={[styles.drawer, { transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] }) }] }]}>
              <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.drawerSafeArea}>
                <View style={styles.drawerHeader}>
                  <View style={styles.wordmark}>
                    <BrandMark size={34} />
                    <Text style={styles.wordmarkText}>Faura-Farmer</Text>
                  </View>
                  <Pressable accessibilityLabel="Close navigation menu" accessibilityRole="button" hitSlop={8} onPress={() => closeDrawer()} style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : undefined]}>
                    <X color={theme.foreground} size={20} strokeWidth={2} />
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
                        style={({ pressed }) => [styles.navigationItem, active ? styles.navigationItemActive : undefined, pressed && !active ? styles.navigationItemPressed : undefined]}
                      >
                        <View style={styles.navigationIcon}>
                          <Icon color={active ? theme.primaryForeground : theme.mutedForeground} size={18} strokeWidth={2} />
                        </View>
                        <Text style={[styles.navigationLabel, active ? styles.navigationLabelActive : undefined]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.drawerFooter}>
                  <Pressable accessibilityLabel="Open profile and settings" accessibilityRole="button" onPress={() => navigate('/more')} style={({ pressed }) => [styles.profileRow, pressed ? styles.navigationItemPressed : undefined]}>
                    <View style={styles.profileAvatar}><Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text></View>
                    <View style={styles.profileCopy}>
                      <Text numberOfLines={1} style={styles.profileName}>{userName}</Text>
                      <Text numberOfLines={1} style={styles.profileEmail}>{session?.user.email ?? 'Profile and settings'}</Text>
                    </View>
                  </Pressable>
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

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: theme.background },
  headerArea: { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: theme.card },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  menuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control },
  headerBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minWidth: 0 },
  headerTitle: { flexShrink: 1, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 14, fontWeight: '600', letterSpacing: -0.6 },
  avatarButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 16, backgroundColor: theme.primarySolid },
  avatarText: { color: theme.primaryForeground, fontFamily: fontFamily.body, fontSize: 13, fontWeight: '700' },
  content: { flex: 1 },
  modalRoot: { flex: 1, flexDirection: 'row' },
  drawer: { zIndex: 2, width: DRAWER_WIDTH, backgroundColor: theme.card, shadowColor: theme.shadow, shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.42, shadowRadius: 16, elevation: 12 },
  drawerSafeArea: { flex: 1, padding: 16 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmarkText: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: 16, fontWeight: '600', letterSpacing: -0.7 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: radius.control },
  navigation: { gap: 4 },
  navigationItem: { minHeight: 46, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start', borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 12 },
  navigationItemActive: { backgroundColor: theme.primarySolid },
  navigationItemPressed: { backgroundColor: theme.accent },
  navigationIcon: { width: 18, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  navigationLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600' },
  navigationLabelActive: { color: theme.primaryForeground },
  drawerFooter: { marginTop: 'auto', borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  profileRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 8 },
  profileAvatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous', borderRadius: 17, backgroundColor: theme.primarySolid },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
  profileEmail: { marginTop: 2, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 0, backgroundColor: theme.overlay },
  backdropPressable: { ...StyleSheet.absoluteFillObject, zIndex: 1, left: DRAWER_WIDTH },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
