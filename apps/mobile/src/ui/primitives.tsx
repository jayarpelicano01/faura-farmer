import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontFamily, radius, type AppTheme, useAppTheme } from './theme';

const AppChromeContext = createContext({ insideAppChrome: false, keyboardVerticalOffset: 0 });

export function AppChromeProvider({ children, keyboardVerticalOffset = 0 }: PropsWithChildren<{ keyboardVerticalOffset?: number }>) {
  return <AppChromeContext.Provider value={{ insideAppChrome: true, keyboardVerticalOffset }}>{children}</AppChromeContext.Provider>;
}

type ScreenProps = PropsWithChildren<{ scrollable?: boolean }>;

export function Screen({ children, scrollable = false }: ScreenProps) {
  const styles = usePrimitiveStyles();
  const appChrome = useContext(AppChromeContext);
  const edges = appChrome.insideAppChrome ? ['left', 'right', 'bottom'] as const : ['top', 'left', 'right'] as const;
  const content = scrollable ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={appChrome.keyboardVerticalOffset}
      style={styles.keyboardAvoiding}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );

  return <SafeAreaView edges={edges} style={styles.screen}>{content}</SafeAreaView>;
}

export function Card({ children }: PropsWithChildren) {
  const styles = usePrimitiveStyles();
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: PropsWithChildren) {
  const styles = usePrimitiveStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  const styles = usePrimitiveStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function BodyText({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  const styles = usePrimitiveStyles();
  return <Text style={[styles.body, muted ? styles.muted : undefined]}>{children}</Text>;
}

export function InlineNotice({ children, tone = 'error' }: PropsWithChildren<{ tone?: 'error' | 'info' }>) {
  const styles = usePrimitiveStyles();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, tone === 'error' ? styles.errorNotice : styles.infoNotice]}>
      <Text style={[styles.noticeText, tone === 'error' ? styles.errorText : styles.infoText]}>{children}</Text>
    </View>
  );
}

type ButtonSize = 'full' | 'constrained' | 'compact';
type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'income' | 'expense';

type ButtonProps = PropsWithChildren<{
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  size?: ButtonSize;
  variant?: ButtonVariant;
}>;

export function Button({ accessibilityLabel, children, onPress, size = 'full', variant = 'default', disabled = false, loading = false }: ButtonProps) {
  const styles = usePrimitiveStyles();
  const isDisabled = disabled || loading;
  const buttonStyle = variant === 'destructive'
    ? styles.destructiveButton
    : variant === 'outline'
      ? styles.outlineButton
      : variant === 'secondary'
        ? styles.secondaryButton
        : variant === 'ghost'
          ? styles.ghostButton
          : variant === 'link'
            ? styles.linkButton
            : variant === 'income'
              ? styles.incomeButton
              : variant === 'expense'
                ? styles.expenseButton
                : styles.primaryButton;
  const textStyle = variant === 'destructive'
    ? styles.destructiveButtonText
    : variant === 'outline' || variant === 'ghost'
      ? styles.neutralButtonText
      : variant === 'secondary'
        ? styles.secondaryButtonText
        : variant === 'link'
          ? styles.linkButtonText
          : styles.buttonText;
  const spinnerColor = variant === 'destructive'
    ? styles.destructiveButtonText.color
    : variant === 'outline' || variant === 'ghost'
      ? styles.neutralButtonText.color
      : variant === 'secondary'
        ? styles.secondaryButtonText.color
        : variant === 'link'
          ? styles.linkButtonText.color
          : styles.buttonText.color;
  const pressedStyle = variant === 'outline' || variant === 'ghost' || variant === 'link'
    ? styles.pressedAccentButton
    : styles.pressedButton;
  const sizeStyle = size === 'constrained'
    ? styles.constrainedButton
    : size === 'compact'
      ? styles.compactButton
      : styles.fullButton;
  return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onPress}
      >
        {({ pressed }) => (
          <View style={[styles.button, sizeStyle, buttonStyle, isDisabled ? styles.disabledButton : undefined, pressed && !isDisabled ? pressedStyle : undefined]}>
            {loading ? <Spinner color={spinnerColor} /> : null}
            <Text style={textStyle}>{children}</Text>
          </View>
        )}
      </Pressable>
  );
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'income' | 'expense' | 'muted';

export function Badge({ children, variant = 'default' }: PropsWithChildren<{ variant?: BadgeVariant }>) {
  const styles = usePrimitiveStyles();
  const badgeStyle = variant === 'secondary'
    ? styles.badgeSecondary
    : variant === 'destructive'
      ? styles.badgeDestructive
      : variant === 'outline'
        ? styles.badgeOutline
        : variant === 'income'
          ? styles.badgeIncome
          : variant === 'expense'
            ? styles.badgeExpense
            : variant === 'muted'
              ? styles.badgeMuted
              : styles.badgeDefault;
  const textStyle = variant === 'secondary'
    ? styles.badgeSecondaryText
    : variant === 'destructive'
      ? styles.badgeDestructiveText
      : variant === 'outline'
        ? styles.badgeOutlineText
        : variant === 'muted'
          ? styles.badgeMutedText
          : variant === 'default'
            ? styles.badgeDefaultText
            : styles.badgeLightText;
  return <View style={[styles.badge, badgeStyle]}><Text style={[styles.badgeText, textStyle]}>{children}</Text></View>;
}

export function Separator({ orientation = 'horizontal', style }: { orientation?: 'horizontal' | 'vertical'; style?: StyleProp<ViewStyle> }) {
  const styles = usePrimitiveStyles();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[orientation === 'horizontal' ? styles.horizontalSeparator : styles.verticalSeparator, style]} />;
}

export function Spinner({ color, size = 16 }: { color?: string; size?: number }) {
  const { theme } = useAppTheme();
  return <ActivityIndicator color={color ?? theme.foreground} size={size} />;
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = usePrimitiveStyles();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.skeleton, { opacity }, style]} />;
}

export function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = usePrimitiveStyles();
  return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
      >
        {({ pressed }) => (
          <View style={[styles.chip, selected ? styles.chipSelected : undefined, pressed ? styles.chipPressed : undefined]}>
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined]}>{label}</Text>
          </View>
        )}
      </Pressable>
  );
}

type DropdownOption = { label: string; value: string };

export function DropdownSelect({ label, options, value, onValueChange, disabled = false }: { label: string; options: DropdownOption[]; value: string; onValueChange: (value: string) => void; disabled?: boolean }) {
  const styles = usePrimitiveStyles();
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value);

  return (
    <>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        {({ pressed }) => (
          <View style={[styles.dropdownTrigger, pressed ? styles.dropdownTriggerPressed : undefined, disabled ? styles.dropdownTriggerDisabled : undefined]}>
            <Text style={[styles.dropdownLabel]}>{label}</Text>
            <Text style={[styles.dropdownValue]}>{selected?.label ?? value}</Text>
            <Text style={styles.dropdownChevron}>▾</Text>
          </View>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dropdownTitle}>{label}</Text>
            <ScrollView style={styles.dropdownScroll}>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => { onValueChange(opt.value); setOpen(false); }}
                  >
                    {({ pressed }) => (
                      <View style={[styles.dropdownItem, pressed ? styles.dropdownItemPressed : undefined, isSelected ? styles.dropdownItemSelected : undefined]}>
                        <Text style={[styles.dropdownItemText, isSelected ? styles.dropdownItemTextSelected : undefined]}>{opt.label}</Text>
                        {isSelected ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.dropdownCancel} onPress={() => setOpen(false)}>
              <Text style={styles.dropdownCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Field({ label, editable = true, style, ...props }: TextInputProps & { label: string }) {
  const styles = usePrimitiveStyles();
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        placeholderTextColor={theme.mutedForeground}
        selectionColor={theme.primary}
        style={[styles.input, !editable ? styles.inputDisabled : undefined, style]}
        {...props}
      />
    </View>
  );
}

export function Empty({ children }: PropsWithChildren) {
  const styles = usePrimitiveStyles();
  return <View style={styles.emptySurface}><Text style={styles.empty}>{children}</Text></View>;
}

export function useUiStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    heading: { color: theme.foreground, fontFamily: fontFamily.display, fontWeight: '600' },
    body: { color: theme.foreground, fontFamily: fontFamily.body },
    muted: { color: theme.mutedForeground, fontFamily: fontFamily.body },
    action: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 15, fontWeight: '600' },
    listTitle: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600' },
    listMeta: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  }), [theme]);
}

function usePrimitiveStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => createStyles(theme), [theme]);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    keyboardAvoiding: { flex: 1 },
    screenContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
    card: {
      marginBottom: 12,
      borderCurve: 'continuous',
      borderRadius: radius.card,
      borderColor: theme.border,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: theme.card,
      padding: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 2,
    },
    title: {color: theme.foreground, fontFamily: fontFamily.display, fontSize: 23, fontWeight: '600', letterSpacing: -1.1, lineHeight: 31 },
    sectionTitle: { color: theme.foreground, fontFamily: fontFamily.display, fontSize: 15, fontWeight: '600', letterSpacing: -0.5, lineHeight: 22 },
    body: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 16, lineHeight: 23 },
    muted: { color: theme.mutedForeground },
    notice: { marginBottom: 16, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10 },
    errorNotice: { backgroundColor: theme.accent, borderColor: theme.expense, borderWidth: StyleSheet.hairlineWidth },
    infoNotice: { backgroundColor: theme.accent },
    noticeText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
    errorText: { color: theme.accentForeground },
    infoText: { color: theme.accentForeground },
    button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderCurve: 'continuous', borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10 },
    fullButton: { alignSelf: 'stretch', minHeight: 46, paddingVertical: 12 },
    constrainedButton: { alignSelf: 'center', width: '100%', maxWidth: 200, minHeight: 46, paddingVertical: 12 },
    compactButton: { alignSelf: 'flex-start', minHeight: 44, paddingVertical: 10 },
    primaryButton: { backgroundColor: theme.primarySolid },
    destructiveButton: { backgroundColor: theme.danger },
    outlineButton: { borderColor: theme.input, borderWidth: 1, backgroundColor: theme.background },
    secondaryButton: { backgroundColor: theme.secondary },
    ghostButton: { backgroundColor: 'transparent' },
    linkButton: { backgroundColor: 'transparent' },
    incomeButton: { backgroundColor: theme.income },
    expenseButton: { backgroundColor: theme.expense },
    disabledButton: { opacity: 0.5 },
    pressedButton: { opacity: 0.86, transform: [{ scale: 0.985 }] },
    pressedAccentButton: { backgroundColor: theme.accent, opacity: 0.86, transform: [{ scale: 0.985 }] },
    buttonText: { color: theme.primarySolidForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    destructiveButtonText: { color: theme.dangerForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    neutralButtonText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    secondaryButtonText: { color: theme.secondaryForeground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    linkButtonText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
    field: { marginBottom: 16 },
    label: { marginBottom: 8, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '500' },
    input: { minHeight: 46, borderCurve: 'continuous', borderWidth: 1, borderColor: theme.input, borderRadius: radius.control, backgroundColor: theme.background, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
    inputDisabled: { backgroundColor: theme.muted, color: theme.mutedForeground, opacity: 0.8 },
    emptySurface: { marginBottom: 12, borderCurve: 'continuous', borderRadius: radius.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.card },
    empty: { paddingHorizontal: 18, paddingVertical: 28, color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    chip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8, borderCurve: 'continuous', borderRadius: radius.control, borderColor: theme.input, borderWidth: 1, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 8 },
    chipSelected: { borderColor: theme.primarySolid, backgroundColor: theme.primarySolid },
    chipPressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
    chipText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14, fontWeight: '600' },
    chipTextSelected: { color: theme.primarySolidForeground },
    dropdownTrigger: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.input, borderRadius: radius.control, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 10 },
    dropdownTriggerPressed: { opacity: 0.86 },
    dropdownTriggerDisabled: { opacity: 0.5 },
    dropdownLabel: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 12, marginRight: 8 },
    dropdownValue: { flex: 1, color: theme.foreground, fontFamily: fontFamily.body, fontSize: 14 },
    dropdownChevron: { color: theme.mutedForeground, fontFamily: fontFamily.body, fontSize: 14 },
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    dropdownSheet: { width: '80%', maxWidth: 320, maxHeight: '60%', backgroundColor: theme.card, borderRadius: radius.card, overflow: 'hidden', shadowColor: theme.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
    dropdownTitle: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: theme.foreground, fontFamily: fontFamily.display, fontSize: 16, fontWeight: '600' },
    dropdownScroll: { maxHeight: 300 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, minHeight: 48 },
    dropdownItemPressed: { backgroundColor: theme.accent },
    dropdownItemSelected: { backgroundColor: theme.accent },
    dropdownItemText: { color: theme.foreground, fontFamily: fontFamily.body, fontSize: 15 },
    dropdownItemTextSelected: { color: theme.primary, fontWeight: '600' },
    dropdownCheck: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 16, fontWeight: '600' },
    dropdownCancel: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingVertical: 14, alignItems: 'center' },
    dropdownCancelText: { color: theme.primary, fontFamily: fontFamily.body, fontSize: 15, fontWeight: '500' },
    badge: { alignSelf: 'flex-start', borderCurve: 'continuous', borderRadius: 999, borderColor: 'transparent', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
    badgeDefault: { backgroundColor: theme.primary },
    badgeSecondary: { backgroundColor: theme.secondary },
    badgeDestructive: { backgroundColor: theme.danger },
    badgeOutline: { borderColor: theme.border, backgroundColor: 'transparent' },
    badgeIncome: { backgroundColor: theme.income },
    badgeExpense: { backgroundColor: theme.expense },
    badgeMuted: { backgroundColor: theme.muted },
    badgeText: { fontFamily: fontFamily.body, fontSize: 12, fontWeight: '600' },
    badgeDefaultText: { color: theme.primaryForeground },
    badgeLightText: { color: theme.primarySolidForeground },
    badgeSecondaryText: { color: theme.secondaryForeground },
    badgeDestructiveText: { color: theme.dangerForeground },
    badgeOutlineText: { color: theme.foreground },
    badgeMutedText: { color: theme.mutedForeground },
    horizontalSeparator: { alignSelf: 'stretch', height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
    verticalSeparator: { alignSelf: 'stretch', width: StyleSheet.hairlineWidth, backgroundColor: theme.border },
    skeleton: { alignSelf: 'stretch', height: 16, borderCurve: 'continuous', borderRadius: radius.control, backgroundColor: theme.muted },
  });
}
